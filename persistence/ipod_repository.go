package persistence

import (
	"context"
	"encoding/json"
	"errors"

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
}

func NewIpodRepository(ctx context.Context, db dbx.Builder) model.IpodRepository {
	r := &ipodRepository{}
	r.ctx = ctx
	r.db = db
	r.tableName = "media_file"
	return r
}

// mediaFiles returns a select over the non-missing media files the current user can access
func (r *ipodRepository) mediaFiles(columns ...string) SelectBuilder {
	sq := Select(columns...).From("media_file mf").Where(Eq{"mf.missing": false})
	return r.applyLibraryFilter(sq, "mf")
}

// songsPerKey groups songs by songKeyExpr, counting on how many iPods each one is found
func (r *ipodRepository) songsPerKey() SelectBuilder {
	return r.mediaFiles(
		songKeyExpr+" AS song_key",
		"count(DISTINCT mf.library_id) AS ipod_count",
		"min(mf.library_id) AS library_id",
		"min(mf.id) AS media_file_id",
		"min(mf.title) AS title",
		"min(mf.artist) AS artist",
	).Where(songKeyExpr + " != ''").GroupBy("song_key")
}

func ignoreNotFound(err error) error {
	if errors.Is(err, model.ErrNotFound) {
		return nil
	}
	return err
}

type dbIpodSong struct {
	MediaFileID string `db:"media_file_id"`
	Title       string `db:"title"`
	Artist      string `db:"artist"`
	IpodCount   int    `db:"ipod_count"`
	IpodNames   string `db:"ipod_names"`
}

func (r *ipodRepository) TopDuplicateSongs(limit int) ([]model.IpodSong, error) {
	sq := r.mediaFiles(
		"min(mf.id) AS media_file_id", "min(mf.title) AS title", "min(mf.artist) AS artist",
		"count(DISTINCT mf.library_id) AS ipod_count",
		"json_group_array(DISTINCT l.name) AS ipod_names",
	).Join("library l ON l.id = mf.library_id").
		Where(songKeyExpr+" != ''").
		GroupBy(songKeyExpr).
		Having("count(DISTINCT mf.library_id) > 1").
		OrderBy("ipod_count DESC", "title").
		Limit(uint64(limit))

	var rows []dbIpodSong
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(s dbIpodSong) model.IpodSong {
		var names []string
		_ = json.Unmarshal([]byte(s.IpodNames), &names)
		return model.IpodSong{
			MediaFileID: s.MediaFileID,
			Title:       s.Title,
			Artist:      s.Artist,
			IpodCount:   s.IpodCount,
			IpodNames:   names,
		}
	}), nil
}

type dbIpodGem struct {
	MediaFileID string `db:"media_file_id"`
	Title       string `db:"title"`
	Artist      string `db:"artist"`
	LibraryID   int    `db:"library_id"`
	LibraryName string `db:"library_name"`
}

func (r *ipodRepository) UniqueGems(limit int) ([]model.IpodGem, error) {
	sq := Select("k.media_file_id", "k.title", "k.artist", "k.library_id", "l.name AS library_name").
		FromSelect(r.songsPerKey(), "k").
		Join("library l ON l.id = k.library_id").
		Where(Eq{"k.ipod_count": 1}).
		OrderBy("random()").
		Limit(uint64(limit))

	var rows []dbIpodGem
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(g dbIpodGem) model.IpodGem {
		return model.IpodGem(g)
	}), nil
}

type dbIpodStats struct {
	LibraryID     int     `db:"library_id"`
	Name          string  `db:"name"`
	SongCount     int     `db:"song_count"`
	DistinctSongs int     `db:"distinct_songs"`
	ArtistCount   int     `db:"artist_count"`
	GenreCount    int     `db:"genre_count"`
	TotalDuration float64 `db:"total_duration"`
	TotalSize     int64   `db:"total_size"`
	AvgYear       float64 `db:"avg_year"`
}

type dbIpodUnique struct {
	LibraryID   int `db:"library_id"`
	UniqueSongs int `db:"unique_songs"`
}

func (r *ipodRepository) Stats() ([]model.IpodStats, error) {
	sq := r.mediaFiles(
		"mf.library_id", "l.name",
		"count(*) AS song_count",
		"count(DISTINCT nullif("+songKeyExpr+", '')) AS distinct_songs",
		"count(DISTINCT CASE WHEN mf.artist_id NOT IN ('', '"+consts.UnknownArtistID+"') THEN mf.artist_id END) AS artist_count",
		"count(DISTINCT nullif(mf.genre, '')) AS genre_count",
		"coalesce(sum(mf.duration), 0) AS total_duration",
		"coalesce(sum(mf.size), 0) AS total_size",
		"coalesce(avg(nullif(mf.year, 0)), 0) AS avg_year",
	).Join("library l ON l.id = mf.library_id").
		GroupBy("mf.library_id").
		OrderBy("l.name")

	var rows []dbIpodStats
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}

	uq := Select("k.library_id", "count(*) AS unique_songs").
		FromSelect(r.songsPerKey(), "k").
		Where(Eq{"k.ipod_count": 1}).
		GroupBy("k.library_id")
	var uniques []dbIpodUnique
	if err := ignoreNotFound(r.queryAll(uq, &uniques)); err != nil {
		return nil, err
	}
	uniqueByLib := make(map[int]int, len(uniques))
	for _, u := range uniques {
		uniqueByLib[u.LibraryID] = u.UniqueSongs
	}

	return slice.Map(rows, func(s dbIpodStats) model.IpodStats {
		return model.IpodStats{
			LibraryID:     s.LibraryID,
			Name:          s.Name,
			SongCount:     s.SongCount,
			DistinctSongs: s.DistinctSongs,
			UniqueSongs:   uniqueByLib[s.LibraryID],
			ArtistCount:   s.ArtistCount,
			GenreCount:    s.GenreCount,
			TotalDuration: s.TotalDuration,
			TotalSize:     s.TotalSize,
			AvgYear:       s.AvgYear,
		}
	}), nil
}

func (r *ipodRepository) Totals() (*model.IpodTotals, error) {
	var songs struct {
		DistinctSongs int `db:"distinct_songs"`
		SharedSongs   int `db:"shared_songs"`
	}
	sq := Select("count(*) AS distinct_songs", "coalesce(sum(k.ipod_count > 1), 0) AS shared_songs").
		FromSelect(r.songsPerKey(), "k")
	if err := ignoreNotFound(r.queryOne(sq, &songs)); err != nil {
		return nil, err
	}

	var genre struct {
		Genre string `db:"genre"`
	}
	gq := r.mediaFiles("mf.genre").
		Where(NotEq{"mf.genre": ""}).
		GroupBy("mf.genre").
		OrderBy("count(*) DESC").
		Limit(1)
	if err := ignoreNotFound(r.queryOne(gq, &genre)); err != nil {
		return nil, err
	}

	var decade struct {
		Decade int `db:"decade"`
	}
	dq := r.mediaFiles("(mf.year / 10) * 10 AS decade").
		Where(Gt{"mf.year": 0}).
		GroupBy("decade").
		OrderBy("count(*) DESC").
		Limit(1)
	if err := ignoreNotFound(r.queryOne(dq, &decade)); err != nil {
		return nil, err
	}

	return &model.IpodTotals{
		DistinctSongs: songs.DistinctSongs,
		SharedSongs:   songs.SharedSongs,
		TopGenre:      genre.Genre,
		TopDecade:     decade.Decade,
	}, nil
}

type dbIpodArtistCount struct {
	LibraryID  int    `db:"library_id"`
	ArtistID   string `db:"artist_id"`
	ArtistName string `db:"artist_name"`
	SongCount  int    `db:"song_count"`
}

func (r *ipodRepository) ArtistCounts() ([]model.IpodArtistCount, error) {
	sq := r.mediaFiles("mf.library_id", "mf.artist_id", "a.name AS artist_name", "count(*) AS song_count").
		Join("artist a ON a.id = mf.artist_id").
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
	sq := Select("count(*) || '|' || coalesce(max(last_scan_at), '') || '|' || coalesce(max(updated_at), '') AS version").
		From("library")
	err := r.queryOne(sq, &res)
	return res.Version, err
}
