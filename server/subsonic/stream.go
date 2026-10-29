package subsonic

import (
	"cmp"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/server/subsonic/responses"
	"github.com/navidrome/navidrome/utils/req"
)

func (api *Router) Stream(w http.ResponseWriter, r *http.Request) (*responses.Subsonic, error) {
	ctx := r.Context()
	p := req.Params(r)
	id, err := p.String("id")
	if err != nil {
		return nil, err
	}
	maxBitRate := p.IntOr("maxBitRate", 0)
	format, _ := p.String("format")
	timeOffset := p.IntOr("timeOffset", 0)

	mf, err := api.ds.MediaFile(ctx).Get(id)
	if err != nil {
		return nil, err
	}

	streamReq := api.transcodeDecision.ResolveRequest(ctx, mf, format, maxBitRate, timeOffset)
	stream, err := api.streamer.NewStream(ctx, mf, streamReq)
	if err != nil {
		return nil, err
	}

	// Make sure the stream will be closed at the end, to avoid leakage
	defer func() {
		if err := stream.Close(); err != nil && log.IsGreaterOrEqualTo(log.LevelDebug) {
			log.Error("Error closing stream", "id", id, "file", stream.Name(), err)
		}
	}()

	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Content-Duration", strconv.FormatFloat(float64(stream.Duration()), 'G', -1, 32))

	_, err = stream.Serve(ctx, w, r)
	return nil, err
}

func (api *Router) Download(w http.ResponseWriter, r *http.Request) (*responses.Subsonic, error) {
	ctx := r.Context()
	username, _ := request.UsernameFrom(ctx)
	p := req.Params(r)
	ids, err := p.Strings("id")
	if err != nil {
		return nil, err
	}
	id := ids[0]

	if !conf.Server.EnableDownloads {
		log.Warn(ctx, "Downloads are disabled", "user", username, "id", id)
		return nil, newError(responses.ErrorAuthorizationFail, "downloads are disabled")
	}

	var entity any
	_, isIpod := ipodDownloadID(id)
	// Several ids are a selection of songs, zipped together below
	if len(ids) == 1 && !isIpod {
		if entity, err = model.GetEntityByID(ctx, api.ds, id); err != nil {
			return nil, err
		}
	}

	maxBitRate := p.IntOr("bitrate", 0)
	format, _ := p.String("format")

	if format == "" {
		if conf.Server.AutoTranscodeDownload {
			// if we are not provided a format, see if we have requested transcoding for this client
			// This must be enabled via a config option. For the UI, we are always given an option.
			// This will impact other clients which do not use the UI
			transcoding, ok := request.TranscodingFrom(ctx)

			if !ok {
				format = "raw"
			} else {
				format = transcoding.TargetFormat
				maxBitRate = transcoding.DefaultBitRate
			}
		} else {
			format = "raw"
		}
	}

	setHeaders := func(name string) {
		name = strings.ReplaceAll(name, ",", "_")
		disposition := fmt.Sprintf("attachment; filename=\"%s.zip\"", name)
		w.Header().Set("Content-Disposition", disposition)
		w.Header().Set("Content-Type", "application/zip")
	}

	if len(ids) > 1 {
		// "album" names a completed album (see the iPods' "complete the album")
		album, _ := p.String("album")
		setHeaders(cmp.Or(album, fmt.Sprintf("%d songs", len(ids))))
		return nil, api.archiver.ZipSongs(ctx, ids, album, format, maxBitRate, w)
	}

	if libraryID, ok := ipodDownloadID(id); ok {
		user, _ := request.UserFrom(ctx)
		if !user.HasLibraryAccess(libraryID) {
			return nil, newError(responses.ErrorDataNotFound, "iPod not found")
		}
		lib, err := api.ds.Library(ctx).Get(libraryID)
		if err != nil {
			return nil, err
		}
		setHeaders(lib.Name)
		return nil, api.archiver.ZipLibrary(ctx, libraryID, format, maxBitRate, w)
	}

	switch v := entity.(type) {
	case *model.MediaFile:
		streamReq := api.transcodeDecision.ResolveRequest(ctx, v, format, maxBitRate, 0)
		stream, err := api.streamer.NewStream(ctx, v, streamReq)
		if err != nil {
			return nil, err
		}

		// Make sure the stream will be closed at the end, to avoid leakage
		defer func() {
			if err := stream.Close(); err != nil && log.IsGreaterOrEqualTo(log.LevelDebug) {
				log.Error("Error closing stream", "id", id, "file", stream.Name(), err)
			}
		}()

		disposition := fmt.Sprintf("attachment; filename=\"%s\"", stream.Name())
		w.Header().Set("Content-Disposition", disposition)

		_, err = stream.Serve(ctx, w, r)
		return nil, err
	case *model.Album:
		setHeaders(v.Name)
		return nil, api.archiver.ZipAlbum(ctx, id, format, maxBitRate, w)
	case *model.Artist:
		setHeaders(v.Name)
		return nil, api.archiver.ZipArtist(ctx, id, format, maxBitRate, w)
	case *model.Playlist:
		setHeaders(v.Name)
		return nil, api.archiver.ZipPlaylist(ctx, id, format, maxBitRate, w)
	default:
		return nil, model.ErrNotFound
	}
}

// ipodDownloadPrefix marks a download of a whole iPod (library): id "ipod-<library id>"
const ipodDownloadPrefix = "ipod-"

func ipodDownloadID(id string) (int, bool) {
	rest, ok := strings.CutPrefix(id, ipodDownloadPrefix)
	if !ok {
		return 0, false
	}
	libraryID, err := strconv.Atoi(rest)
	return libraryID, err == nil
}
