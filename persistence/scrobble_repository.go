package persistence

import (
	"context"
	"time"

	. "github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/slice"
	"github.com/pocketbase/dbx"
)

type scrobbleRepository struct {
	sqlRepository
}

func NewScrobbleRepository(ctx context.Context, db dbx.Builder) model.ScrobbleRepository {
	r := &scrobbleRepository{}
	r.ctx = ctx
	r.db = db
	r.tableName = "scrobbles"
	return r
}

func (r *scrobbleRepository) RecordScrobble(mediaFileID string, submissionTime time.Time) error {
	userID := loggedUser(r.ctx).ID
	values := map[string]any{
		"media_file_id":   mediaFileID,
		"user_id":         userID,
		"submission_time": submissionTime.Unix(),
	}
	insert := Insert(r.tableName).SetMap(values)
	_, err := r.executeSQL(insert)
	return err
}

type dbScrobbleEntry struct {
	UserID         string    `db:"user_id"`
	Username       string    `db:"user_name"`
	SubmissionTime int64     `db:"submission_time"`
	MediaFileID    string    `db:"media_file_id"`
	Title          string    `db:"title"`
	Artist         string    `db:"artist"`
	Album          string    `db:"album"`
	AlbumID        string    `db:"album_id"`
	ArtistID       string    `db:"artist_id"`
	AlbumArtistID  string    `db:"album_artist_id"`
	Duration       float32   `db:"duration"`
	UpdatedAt      time.Time `db:"updated_at"`
	LibraryID      int       `db:"library_id"`
	LibraryName    string    `db:"library_name"`
}

func (r *scrobbleRepository) GetRecentAll(limit int) ([]model.ListenEntry, error) {
	q := Select(
		"s.user_id", "u.user_name", "s.submission_time",
		"mf.id AS media_file_id", "mf.title", "mf.artist", "mf.album",
		"mf.album_id", "mf.artist_id", "mf.album_artist_id",
		"mf.duration", "mf.updated_at",
		"mf.library_id", "l.name AS library_name",
	).From("scrobbles s").
		Join("user u ON u.id = s.user_id").
		Join("media_file mf ON mf.id = s.media_file_id").
		Join("library l ON l.id = mf.library_id").
		Where(Eq{"u.share_activity": true}).
		OrderBy("s.submission_time DESC").
		Limit(uint64(limit))

	var rows []dbScrobbleEntry
	err := r.queryAll(q, &rows)
	if err != nil && err != model.ErrNotFound {
		return nil, err
	}

	return slice.Map(rows, dbScrobbleEntry.toModel), nil
}

func (e dbScrobbleEntry) toModel() model.ListenEntry {
	return model.ListenEntry{
		UserID:         e.UserID,
		Username:       e.Username,
		SubmissionTime: time.Unix(e.SubmissionTime, 0),
		MediaFile: model.MediaFile{
			ID:            e.MediaFileID,
			Title:         e.Title,
			Artist:        e.Artist,
			Album:         e.Album,
			AlbumID:       e.AlbumID,
			ArtistID:      e.ArtistID,
			AlbumArtistID: e.AlbumArtistID,
			Duration:      e.Duration,
			UpdatedAt:     e.UpdatedAt,
			LibraryID:     e.LibraryID,
			LibraryName:   e.LibraryName,
		},
	}
}
