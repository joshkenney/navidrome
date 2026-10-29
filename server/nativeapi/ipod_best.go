package nativeapi

import (
	"cmp"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"

	"github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/req"
	"github.com/navidrome/navidrome/utils/songkey"
)

// The same song is often on several iPods, ripped at different qualities. These endpoints find the
// best copy of a song on all the iPods ("the heap"), and complete an album with every iPod's copy
// of it, so downloads can recommend them

// bestCopyMaxDrift is how much longer or shorter (in seconds) another copy of a song can be:
// song Keys ignore "Live" and "Edit" suffixes, and such versions are usually longer or shorter
const bestCopyMaxDrift = 3

type ipodCopy struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	Album       string `json:"album"`
	DiscNumber  int    `json:"discNumber"`
	TrackNumber int    `json:"trackNumber"`
	LibraryID   int    `json:"libraryId"`
	LibraryName string `json:"libraryName"`
	Suffix      string `json:"suffix"`
	BitRate     int    `json:"bitRate"`
	SampleRate  int    `json:"sampleRate"`
	BitDepth    int    `json:"bitDepth"`
	Lossless    bool   `json:"lossless"`
	Size        int64  `json:"size"`
}

func newIpodCopy(mf model.MediaFile) ipodCopy {
	return ipodCopy{
		ID: mf.ID, Title: mf.Title, Artist: mf.Artist, Album: mf.Album,
		DiscNumber: mf.DiscNumber, TrackNumber: mf.TrackNumber,
		LibraryID: mf.LibraryID, LibraryName: mf.LibraryName,
		Suffix: mf.Suffix, BitRate: mf.BitRate, SampleRate: mf.SampleRate, BitDepth: mf.BitDepth,
		Lossless: isLossless(mf), Size: mf.Size,
	}
}

var losslessCodecs = []string{"flac", "alac", "pcm", "wav", "aiff", "ape", "wv", "wavpack", "tta", "tak", "shn", "dsd"}

func isLossless(mf model.MediaFile) bool {
	return slices.Contains(losslessCodecs, mf.AudioCodec())
}

// compareQuality is positive when a sounds better than b: lossless beats lossy, then lossless
// copies are compared by bit depth and sample rate, and lossy ones by bit rate
func compareQuality(a, b model.MediaFile) int {
	al, bl := isLossless(a), isLossless(b)
	if al != bl {
		if al {
			return 1
		}
		return -1
	}
	if !al {
		return cmp.Compare(a.BitRate, b.BitRate)
	}
	depth := func(mf model.MediaFile) (int, int) {
		// DSD stores 1-bit samples at 64 times CD rate, roughly 24-bit at 8 times less
		if mf.AudioCodec() == "dsd" {
			return 24, mf.SampleRate / 8
		}
		return mf.BitDepth, mf.SampleRate
	}
	ad, ar := depth(a)
	bd, br := depth(b)
	return cmp.Or(cmp.Compare(ad, bd), cmp.Compare(ar, br))
}

// bestOf returns the best sounding of the copies, the first one among equals
func bestOf(copies model.MediaFiles) model.MediaFile {
	best := copies[0]
	for _, mf := range copies[1:] {
		if compareQuality(mf, best) > 0 {
			best = mf
		}
	}
	return best
}

type ipodBestResponse struct {
	Current ipodCopy `json:"current"`
	// Best is only set when another copy sounds better than Current
	Best *ipodCopy `json:"best,omitempty"`
	// Copies counts the copies of the song on all iPods, Current included
	Copies int `json:"copies"`
}

// bestSongCopy compares a song with its copies (which may include it), and recommends the best
func bestSongCopy(current model.MediaFile, copies model.MediaFiles) ipodBestResponse {
	resp := ipodBestResponse{Current: newIpodCopy(current), Copies: 1}
	var same model.MediaFiles
	for _, mf := range copies {
		if mf.ID == current.ID {
			continue
		}
		if current.Duration > 0 && mf.Duration > 0 &&
			math.Abs(float64(current.Duration-mf.Duration)) > bestCopyMaxDrift {
			continue
		}
		same = append(same, mf)
	}
	resp.Copies += len(same)
	if len(same) == 0 {
		return resp
	}
	if best := bestOf(same); compareQuality(best, current) > 0 {
		c := newIpodCopy(best)
		resp.Best = &c
	}
	return resp
}

type ipodAlbumTrack struct {
	ipodCopy
	// Status is "here" when this album's own copy is the best one, "better" when another iPod has
	// a better copy, and "added" when the song is missing from this album
	Status string `json:"status"`
}

type ipodAlbumResponse struct {
	Tracks []ipodAlbumTrack `json:"tracks"`
	Here   int              `json:"here"`
	Better int              `json:"better"`
	Added  int              `json:"added"`
	// Ipods are the other iPods the better and added songs come from
	Ipods []string `json:"ipods"`
	Size  int64    `json:"size"`
}

// albumTrackKey matches the same song in different copies of an album: by its song Key, or by its
// position when its title is a placeholder like "Track 05"
func albumTrackKey(mf model.MediaFile) string {
	if k := songkey.Key(mf.Title, mf.ArtistID, mf.OrderArtistName); k != "" {
		return k
	}
	if mf.TrackNumber > 0 {
		return fmt.Sprintf("#%d/%d", mf.DiscNumber, mf.TrackNumber)
	}
	return "id:" + mf.ID
}

// completeAlbum merges an album's own songs with other copies of it: one track per song, the
// best sounding copy of it, in the order of the album (or of the copy that adds it)
func completeAlbum(own, others model.MediaFiles) ipodAlbumResponse {
	type group struct {
		own, all model.MediaFiles
	}
	groups := map[string]*group{}
	var order []string
	add := func(mf model.MediaFile, isOwn bool) {
		k := albumTrackKey(mf)
		g, ok := groups[k]
		if !ok {
			g = &group{}
			groups[k] = g
			order = append(order, k)
		}
		if isOwn {
			g.own = append(g.own, mf)
		}
		g.all = append(g.all, mf)
	}
	// Own songs first, so they win among equals and set the order of the tracks
	for _, mf := range own {
		add(mf, true)
	}
	for _, mf := range others {
		add(mf, false)
	}

	resp := ipodAlbumResponse{Tracks: []ipodAlbumTrack{}, Ipods: []string{}}
	position := map[string]model.MediaFile{}
	for _, k := range order {
		g := groups[k]
		best := bestOf(g.all)
		t := ipodAlbumTrack{ipodCopy: newIpodCopy(best)}
		switch {
		case len(g.own) == 0:
			t.Status = "added"
			resp.Added++
			position[best.ID] = best
		case compareQuality(best, bestOf(g.own)) > 0:
			t.Status = "better"
			resp.Better++
			position[best.ID] = bestOf(g.own)
		default:
			t.Status = "here"
			resp.Here++
			position[best.ID] = best
		}
		if t.Status != "here" && !slices.Contains(resp.Ipods, best.LibraryName) {
			resp.Ipods = append(resp.Ipods, best.LibraryName)
		}
		resp.Size += best.Size
		resp.Tracks = append(resp.Tracks, t)
	}
	slices.SortStableFunc(resp.Tracks, func(a, b ipodAlbumTrack) int {
		pa, pb := position[a.ID], position[b.ID]
		return cmp.Or(cmp.Compare(pa.DiscNumber, pb.DiscNumber), cmp.Compare(pa.TrackNumber, pb.TrackNumber))
	})
	slices.Sort(resp.Ipods)
	return resp
}

// heapFilter leaves out missing songs, and the libraries combining other libraries (which would
// count every song twice)
func (api *Router) heapFilter(r *http.Request) (squirrel.And, error) {
	libs, err := api.ds.Library(r.Context()).GetAll()
	if err != nil {
		return nil, err
	}
	filter := squirrel.And{squirrel.Eq{"media_file.missing": false}}
	if combined := libs.Combined().IDs(); len(combined) > 0 {
		filter = append(filter, squirrel.NotEq{"media_file.library_id": combined})
	}
	return filter, nil
}

func (api *Router) getIpodBestCopy(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := req.Params(r).String("id")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	current, err := api.ds.MediaFile(ctx).Get(id)
	if errors.Is(err, model.ErrNotFound) {
		http.Error(w, "song not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Error(ctx, "Error loading song", "id", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	key := songkey.Key(current.Title, current.ArtistID, current.OrderArtistName)
	if key == "" {
		writeJSON(ctx, w, bestSongCopy(*current, nil))
		return
	}
	filter, err := api.heapFilter(r)
	if err != nil {
		log.Error(ctx, "Error loading libraries", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	filter = append(filter, squirrel.Expr(
		"SONG_KEY(media_file.title, media_file.artist_id, media_file.order_artist_name) = ?", key))
	copies, err := api.ds.MediaFile(ctx).GetAll(model.QueryOptions{Filters: filter})
	if err != nil {
		log.Error(ctx, "Error loading copies of song", "id", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, bestSongCopy(*current, copies))
}

func (api *Router) getIpodCompleteAlbum(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := req.Params(r).String("id")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	album, err := api.ds.Album(ctx).Get(id)
	if errors.Is(err, model.ErrNotFound) {
		http.Error(w, "album not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Error(ctx, "Error loading album", "id", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	own, err := api.ds.MediaFile(ctx).GetAll(model.QueryOptions{
		Filters: squirrel.Eq{"media_file.album_id": id, "media_file.missing": false},
		Sort:    "album",
	})
	if err != nil {
		log.Error(ctx, "Error loading album songs", "id", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Other copies of the album are matched like songs: by name (without "Remastered" and such
	// suffixes) and album artist
	var others model.MediaFiles
	if key := songkey.Key(album.Name, album.AlbumArtistID, album.OrderAlbumArtistName); key != "" {
		filter, err := api.heapFilter(r)
		if err != nil {
			log.Error(ctx, "Error loading libraries", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		filter = append(filter, squirrel.NotEq{"media_file.album_id": id}, squirrel.Expr(
			"SONG_KEY(media_file.album, media_file.album_artist_id, media_file.order_album_artist_name) = ?", key))
		others, err = api.ds.MediaFile(ctx).GetAll(model.QueryOptions{Filters: filter, Sort: "album"})
		if err != nil {
			log.Error(ctx, "Error loading other copies of album", "id", id, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}
	writeJSON(ctx, w, completeAlbum(own, others))
}
