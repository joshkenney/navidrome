package nativeapi

import (
	"errors"
	"net/http"

	"github.com/Masterminds/squirrel"
	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
)

// Replay is each user's own playlist of the songs they played through: the web player reports a
// song once it played replayThreshold of it, and the song is added to the user's Replay playlist
// (created on the first one), once. Like any playlist, it can be played, shared and downloaded

const (
	replayPlaylistName    = "Replay"
	replayPlaylistComment = "Songs you played through (85% or more), added automatically"
)

func (api *Router) addReplayRoutes(r chi.Router) {
	r.Post("/replay/{id}", api.addToReplay)
}

func (api *Router) addToReplay(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := request.UserFrom(ctx)
	if !ok {
		http.Error(w, "not logged in", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	// Checks the song exists and the user can access it
	if _, err := api.ds.MediaFile(ctx).Get(id); err != nil {
		if errors.Is(err, model.ErrNotFound) {
			http.Error(w, "song not found", http.StatusNotFound)
			return
		}
		log.Error(ctx, "Error loading song for Replay", "id", id, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	added := false
	err := api.ds.WithTx(func(tx model.DataStore) error {
		repo := tx.Playlist(ctx)
		pls, err := repo.GetAll(model.QueryOptions{
			Filters: squirrel.Eq{"playlist.owner_id": user.ID, "playlist.name": replayPlaylistName},
			Sort:    "playlist.created_at",
			Max:     1,
		})
		if err != nil {
			return err
		}
		var plsID string
		if len(pls) > 0 {
			plsID = pls[0].ID
		} else {
			p := &model.Playlist{Name: replayPlaylistName, Comment: replayPlaylistComment, OwnerID: user.ID}
			if err := repo.Put(p); err != nil {
				return err
			}
			plsID = p.ID
		}
		tracks := repo.Tracks(plsID, false)
		existing, err := tracks.GetAll(model.QueryOptions{
			Filters: squirrel.Eq{"playlist_tracks.media_file_id": id}, Max: 1,
		})
		if err != nil {
			return err
		}
		if len(existing) > 0 {
			return nil
		}
		added = true
		_, err = tracks.Add([]string{id})
		return err
	}, "addToReplay")
	if err != nil {
		log.Error(ctx, "Error adding song to Replay", "id", id, "user", user.UserName, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, map[string]bool{"added": added})
}
