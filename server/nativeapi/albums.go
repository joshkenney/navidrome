package nativeapi

import (
	"context"
	"errors"
	"io"
	"net/http"

	"github.com/deluan/rest"
	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/core/coverart"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/server"
)

func (api *Router) addAlbumRoute(r chi.Router) {
	constructor := func(ctx context.Context) rest.Repository {
		return api.ds.Resource(ctx, model.Album{})
	}
	r.Route("/album", func(r chi.Router) {
		r.Get("/", rest.GetAll(constructor))
		r.Route("/{id}", func(r chi.Router) {
			r.Use(server.URLParamsMiddleware)
			r.Get("/", rest.Get(constructor))
			r.Post("/image", api.uploadAlbumImage())
			r.Delete("/image", api.deleteAlbumImage())
		})
	})
}

// albumFromURL returns the album whose cover is changed. Album covers are shown to every user, so
// only admins can change them, even when EnableArtworkUpload lets users change other images
func (api *Router) albumFromURL(ctx context.Context) (*model.Album, error) {
	if user, _ := request.UserFrom(ctx); !user.IsAdmin {
		return nil, model.ErrNotAuthorized
	}
	al, err := api.ds.Album(ctx).Get(chi.URLParamFromCtx(ctx, "id"))
	if errors.Is(err, model.ErrNotFound) {
		return nil, model.ErrNotFound
	}
	return al, err
}

// uploadAlbumImage sets the album's cover, kept in the data folder (see model.AlbumCoverPath). It
// is used before the album's own images and any cover found online
func (api *Router) uploadAlbumImage() http.HandlerFunc {
	return handleImageUpload(func(ctx context.Context, reader io.Reader, ext string) error {
		al, err := api.albumFromURL(ctx)
		if err != nil {
			return err
		}
		old := model.AlbumCoverPath(al.ID, false)
		filename, err := api.imgUpload.SetImage(ctx, consts.EntityAlbum, al.ID, "", old, reader, ext)
		if err != nil {
			return err
		}
		model.RecordAlbumCover(old)
		model.RecordAlbumCover(model.UploadedImagePath(consts.EntityAlbum, filename))
		return api.ds.Album(ctx).TouchCover(al.ID)
	})
}

// deleteAlbumImage removes the cover set by an admin. Without one, it removes the cover found
// online, which is then not looked up again: it was probably the wrong album
func (api *Router) deleteAlbumImage() http.HandlerFunc {
	return handleImageDelete(func(ctx context.Context) error {
		al, err := api.albumFromURL(ctx)
		if err != nil {
			return err
		}
		if manual := model.AlbumCoverPath(al.ID, false); manual != "" {
			if err := api.imgUpload.RemoveImage(ctx, manual); err != nil {
				return err
			}
			model.RecordAlbumCover(manual)
		} else if found := model.AlbumCoverPath(al.ID, true); found != "" {
			if err := api.imgUpload.RemoveImage(ctx, found); err != nil {
				return err
			}
			model.RecordAlbumCover(found)
			if err := coverart.Reject(ctx, api.ds, al.ID); err != nil {
				return err
			}
		} else {
			return nil
		}
		return api.ds.Album(ctx).TouchCover(al.ID)
	})
}
