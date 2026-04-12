package nativeapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/utils/req"
)

type activityEntry struct {
	UserID         string    `json:"userId"`
	Username       string    `json:"username"`
	SubmissionTime time.Time `json:"submissionTime"`
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Artist         string    `json:"artist"`
	Album          string    `json:"album"`
	AlbumID        string    `json:"albumId"`
	ArtistID       string    `json:"artistId"`
	AlbumArtistID  string    `json:"albumArtistId"`
	Duration       float32   `json:"duration"`
	UpdatedAt      time.Time `json:"updatedAt"`
	LibraryID      int       `json:"libraryId"`
	LibraryName    string    `json:"libraryName,omitempty"`
}

func (api *Router) addActivityRoute(r chi.Router) {
	r.Get("/activity/recent", api.getRecentActivity)
}

func (api *Router) getRecentActivity(w http.ResponseWriter, r *http.Request) {
	p := req.Params(r)
	limit := min(p.IntOr("count", 20), 200)

	entries, err := api.ds.Scrobble(r.Context()).GetRecentAll(limit)
	if err != nil {
		log.Error(r.Context(), "Error retrieving recent activity", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	result := make([]activityEntry, len(entries))
	for i, e := range entries {
		result[i] = activityEntry{
			UserID:         e.UserID,
			Username:       e.Username,
			SubmissionTime: e.SubmissionTime,
			ID:             e.MediaFile.ID,
			Title:          e.MediaFile.Title,
			Artist:         e.MediaFile.Artist,
			Album:          e.MediaFile.Album,
			AlbumID:        e.MediaFile.AlbumID,
			ArtistID:       e.MediaFile.ArtistID,
			AlbumArtistID:  e.MediaFile.AlbumArtistID,
			Duration:       e.MediaFile.Duration,
			UpdatedAt:      e.MediaFile.UpdatedAt,
			LibraryID:      e.MediaFile.LibraryID,
			LibraryName:    e.MediaFile.LibraryName,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Error(r.Context(), "Error encoding activity response", err)
	}
}
