package persistence

import (
	"context"
	"errors"
	"path/filepath"
	"strings"

	. "github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/slice"
	"github.com/pocketbase/dbx"
)

// songKeyExpr identifies "the same song" across iPods (see songkey.Key). It is empty for
// placeholder songs, like "Track 05" or songs by [Unknown Artist]
const songKeyExpr = "SONG_KEY(mf.title, mf.artist_id)"

type ipodRepository struct {
	sqlRepository
	combined []int
	loaded   bool
}

func NewIpodRepository(ctx context.Context, db dbx.Builder) model.IpodRepository {
	r := &ipodRepository{}
	r.ctx = ctx
	r.db = db
	r.tableName = "media_file"
	return r
}

// mediaFiles returns a select over the non-missing media files the current user can access,
// leaving out libraries that combine other libraries
func (r *ipodRepository) mediaFiles(columns ...string) (SelectBuilder, error) {
	combined, err := r.combinedLibraryIDs()
	if err != nil {
		return SelectBuilder{}, err
	}
	sq := Select(columns...).From("media_file mf").Where(Eq{"mf.missing": false})
	if len(combined) > 0 {
		sq = sq.Where(NotEq{"mf.library_id": combined})
	}
	return r.applyLibraryFilter(sq, "mf"), nil
}

type dbLibraryPath struct {
	ID   int    `db:"id"`
	Path string `db:"path"`
}

// combinedLibraryIDs returns the libraries whose folder contains another library's folder
func (r *ipodRepository) combinedLibraryIDs() ([]int, error) {
	if r.loaded {
		return r.combined, nil
	}
	var libs []dbLibraryPath
	if err := ignoreNotFound(r.queryAll(Select("id", "path").From("library"), &libs)); err != nil {
		return nil, err
	}
	r.combined = findCombinedLibraries(libs)
	r.loaded = true
	return r.combined, nil
}

func findCombinedLibraries(libs []dbLibraryPath) []int {
	var combined []int
	for _, parent := range libs {
		prefix := filepath.Clean(parent.Path)
		if !strings.HasSuffix(prefix, string(filepath.Separator)) {
			prefix += string(filepath.Separator)
		}
		for _, child := range libs {
			if child.ID != parent.ID && strings.HasPrefix(filepath.Clean(child.Path), prefix) {
				combined = append(combined, parent.ID)
				break
			}
		}
	}
	return combined
}

func ignoreNotFound(err error) error {
	if errors.Is(err, model.ErrNotFound) {
		return nil
	}
	return err
}

type dbIpodSongEntry struct {
	Key         string `db:"song_key"`
	LibraryID   int    `db:"library_id"`
	MediaFileID string `db:"media_file_id"`
	Title       string `db:"title"`
	Artist      string `db:"artist"`
}

func (r *ipodRepository) SongIndex() ([]model.IpodSongEntry, error) {
	// Filtering placeholders in HAVING (not WHERE) computes the song key only once per track
	sq, err := r.mediaFiles(
		songKeyExpr+" AS song_key", "mf.library_id",
		"min(mf.id) AS media_file_id", "min(mf.title) AS title", "min(mf.artist) AS artist",
	)
	if err != nil {
		return nil, err
	}
	sq = sq.GroupBy("song_key", "mf.library_id").Having("song_key != ''")

	var rows []dbIpodSongEntry
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(e dbIpodSongEntry) model.IpodSongEntry {
		return model.IpodSongEntry(e)
	}), nil
}

type dbIpodStats struct {
	LibraryID     int     `db:"library_id"`
	Name          string  `db:"name"`
	SongCount     int     `db:"song_count"`
	ArtistCount   int     `db:"artist_count"`
	GenreCount    int     `db:"genre_count"`
	TotalDuration float64 `db:"total_duration"`
	TotalSize     int64   `db:"total_size"`
	AvgYear       float64 `db:"avg_year"`
}

func (r *ipodRepository) Stats() ([]model.IpodStats, error) {
	sq, err := r.mediaFiles(
		"mf.library_id", "l.name",
		"count(*) AS song_count",
		"count(DISTINCT CASE WHEN mf.artist_id NOT IN ('', '"+consts.UnknownArtistID+"') THEN mf.artist_id END) AS artist_count",
		"count(DISTINCT nullif(mf.genre, '')) AS genre_count",
		"coalesce(sum(mf.duration), 0) AS total_duration",
		"coalesce(sum(mf.size), 0) AS total_size",
		"coalesce(avg(nullif(mf.year, 0)), 0) AS avg_year",
	)
	if err != nil {
		return nil, err
	}
	sq = sq.Join("library l ON l.id = mf.library_id").
		GroupBy("mf.library_id").
		OrderBy("l.name")

	var rows []dbIpodStats
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(s dbIpodStats) model.IpodStats {
		return model.IpodStats{
			LibraryID:     s.LibraryID,
			Name:          s.Name,
			SongCount:     s.SongCount,
			ArtistCount:   s.ArtistCount,
			GenreCount:    s.GenreCount,
			TotalDuration: s.TotalDuration,
			TotalSize:     s.TotalSize,
			AvgYear:       s.AvgYear,
		}
	}), nil
}

func (r *ipodRepository) Totals() (*model.IpodTotals, error) {
	var genre struct {
		Genre string `db:"genre"`
	}
	gq, err := r.mediaFiles("mf.genre")
	if err != nil {
		return nil, err
	}
	gq = gq.Where(NotEq{"mf.genre": ""}).
		GroupBy("mf.genre").
		OrderBy("count(*) DESC").
		Limit(1)
	if err := ignoreNotFound(r.queryOne(gq, &genre)); err != nil {
		return nil, err
	}

	var decade struct {
		Decade int `db:"decade"`
	}
	dq, err := r.mediaFiles("(mf.year / 10) * 10 AS decade")
	if err != nil {
		return nil, err
	}
	dq = dq.Where(Gt{"mf.year": 0}).
		GroupBy("decade").
		OrderBy("count(*) DESC").
		Limit(1)
	if err := ignoreNotFound(r.queryOne(dq, &decade)); err != nil {
		return nil, err
	}

	return &model.IpodTotals{TopGenre: genre.Genre, TopDecade: decade.Decade}, nil
}

type dbIpodArtistCount struct {
	LibraryID  int    `db:"library_id"`
	ArtistID   string `db:"artist_id"`
	ArtistName string `db:"artist_name"`
	SongCount  int    `db:"song_count"`
}

func (r *ipodRepository) ArtistCounts() ([]model.IpodArtistCount, error) {
	sq, err := r.mediaFiles("mf.library_id", "mf.artist_id", "a.name AS artist_name", "count(*) AS song_count")
	if err != nil {
		return nil, err
	}
	sq = sq.Join("artist a ON a.id = mf.artist_id").
		Where(NotEq{"mf.artist_id": consts.UnknownArtistID}).
		GroupBy("mf.library_id", "mf.artist_id")

	var rows []dbIpodArtistCount
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(a dbIpodArtistCount) model.IpodArtistCount {
		return model.IpodArtistCount(a)
	}), nil
}

func (r *ipodRepository) DataVersion() (string, error) {
	var res struct {
		Version string `db:"version"`
	}
	sq := Select("coalesce(group_concat(id), '') || '|' || coalesce(max(last_scan_at), '') || '|' || " +
		"coalesce(max(updated_at), '') AS version").From("library")
	if user := loggedUser(r.ctx); !user.IsAdmin && user.ID != invalidUserId {
		sq = sq.Where(Expr("id IN (SELECT ul.library_id FROM user_library ul WHERE ul.user_id = ?)", user.ID))
	}
	err := r.queryOne(sq, &res)
	return res.Version, err
}
