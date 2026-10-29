package persistence

import (
	"context"
	"math/rand/v2"
	"slices"
	"strings"
	"time"

	. "github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/slice"
	"github.com/pocketbase/dbx"
)

// eraYearExpr is the year a song first came out: its original year when tagged, else its year
const eraYearExpr = "coalesce(nullif(mf.original_year, 0), mf.year)"

// firstEraYear is the earliest year taken seriously: older years are tagging mistakes
const firstEraYear = 1900

type erasRepository struct {
	listeningRepository
}

func NewErasRepository(ctx context.Context, db dbx.Builder) model.ErasRepository {
	r := &erasRepository{}
	r.ctx = ctx
	r.db = db
	r.tableName = "media_file"
	return r
}

func lastEraYear() int { return time.Now().Year() + 1 }

// songs returns a select over the music (not spoken word) the user can access, with the user's
// play counts joined as "a"
func (r *erasRepository) songs(columns ...string) (SelectBuilder, error) {
	sq, err := r.mediaFiles(columns...)
	if err != nil {
		return sq, err
	}
	return sq.Where("NOT "+spokenExpr()).
		LeftJoin("annotation a ON a.item_id = mf.id AND a.item_type = 'media_file' AND a.user_id = ?",
			loggedUser(r.ctx).ID), nil
}

func eraYears(from, to int) Sqlizer {
	return And{
		Expr(eraYearExpr+" >= ?", max(from, firstEraYear)),
		Expr(eraYearExpr+" <= ?", min(to, lastEraYear())),
	}
}

type dbEraYear struct {
	Year    int `db:"year"`
	Songs   int `db:"songs"`
	Albums  int `db:"albums"`
	Artists int `db:"artists"`
	Played  int `db:"played"`
}

func (r *erasRepository) Eras() (*model.Eras, error) {
	sq, err := r.songs(eraYearExpr+" AS year", "count(*) AS songs", "count(DISTINCT mf.album_id) AS albums",
		"count(DISTINCT mf.artist_id) AS artists", "sum("+playedExpr+") AS played")
	if err != nil {
		return nil, err
	}
	// By the expression: "year" alone would be the song's own year column
	sq = sq.GroupBy(eraYearExpr).OrderBy(eraYearExpr)
	var rows []dbEraYear
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	res := &model.Eras{Years: []model.EraYear{}}
	for _, y := range rows {
		if y.Year < firstEraYear || y.Year > lastEraYear() {
			res.Undated += y.Songs
			continue
		}
		res.Years = append(res.Years, model.EraYear(y))
	}
	return res, nil
}

type dbEraGenre struct {
	Name  string `db:"name"`
	Songs int    `db:"songs"`
}

func (r *erasRepository) Era(from, to int, limit int) (*model.Era, error) {
	limit = max(limit, 1)
	res := &model.Era{From: from, To: to}
	sq, err := r.songs("count(*) AS songs", "coalesce(sum("+playedExpr+"), 0) AS played")
	if err != nil {
		return nil, err
	}
	var totals struct {
		Songs  int `db:"songs"`
		Played int `db:"played"`
	}
	if err := ignoreNotFound(r.queryOne(sq.Where(eraYears(from, to)), &totals)); err != nil {
		return nil, err
	}
	res.Songs, res.Played = totals.Songs, totals.Played

	if sq, err = r.songs("mf.artist_id AS id", "mf.artist AS name", "count(*) AS songs",
		"sum("+playedExpr+") AS plays"); err != nil {
		return nil, err
	}
	sq = sq.Where(eraYears(from, to)).
		Where(NotEq{"mf.artist_id": []string{consts.VariousArtistsID, consts.UnknownArtistID, ""}}).
		GroupBy("mf.artist_id").OrderBy("songs DESC").Limit(uint64(limit))
	if res.Artists, err = r.counts(sq); err != nil {
		return nil, err
	}

	// The same album on several iPods counts once, and the albums on the most iPods come first
	if sq, err = r.songs("min(mf.album_id) AS id", "mf.album AS name", "mf.album_artist AS artist",
		"mf.album_artist_id AS artist_id", "min(mf.album_id) AS album_id", "min(mf.library_id) AS library_id",
		"max(mf.updated_at) AS updated_at", "count(DISTINCT mf.library_id) AS ipods",
		"count(DISTINCT mf.id) AS songs", "sum("+playedExpr+") AS plays"); err != nil {
		return nil, err
	}
	sq = sq.Where(eraYears(from, to)).Where(NotEq{"mf.album": ""}).
		GroupBy("mf.album_artist_id", "lower(mf.album)").
		OrderBy("ipods DESC", "songs DESC").Limit(uint64(limit))
	if res.Albums, err = r.counts(sq); err != nil {
		return nil, err
	}
	if err = r.fillLibraryNames(res.Albums); err != nil {
		return nil, err
	}

	if sq, err = r.songs("min(mf.genre) AS name", "count(*) AS songs"); err != nil {
		return nil, err
	}
	sq = sq.Where(eraYears(from, to)).Where(NotEq{"coalesce(mf.genre, '')": ""}).
		GroupBy("lower(mf.genre)").OrderBy("songs DESC").Limit(uint64(limit))
	var genres []dbEraGenre
	if err := ignoreNotFound(r.queryAll(sq, &genres)); err != nil {
		return nil, err
	}
	res.Genres = slice.Map(genres, func(g dbEraGenre) model.EraGenre { return model.EraGenre(g) })

	if sq, err = r.songs("cast(mf.library_id AS text) AS id", "l.name AS name", "mf.library_id",
		"l.name AS library_name", "count(*) AS songs", "sum("+playedExpr+") AS plays"); err != nil {
		return nil, err
	}
	sq = sq.Join("library l ON l.id = mf.library_id").Where(eraYears(from, to)).
		GroupBy("mf.library_id").OrderBy("songs DESC").Limit(uint64(limit))
	if res.Ipods, err = r.counts(sq); err != nil {
		return nil, err
	}
	return res, nil
}

type dbEraPick struct {
	ID     string `db:"id"`
	Year   int    `db:"year"`
	Artist string `db:"artist_id"`
	Title  string `db:"title"`
}

func (r *erasRepository) EraSongs(opts model.EraSongsOptions) (model.MediaFiles, error) {
	want := max(opts.Max, 1)
	// A shuffle takes at most two songs per artist. A journey takes about the same number of
	// songs from each year, so every year is heard
	partition, perGroup := "mf.artist_id", 2
	if opts.Journey {
		years := max(min(opts.To, lastEraYear())-max(opts.From, firstEraYear)+1, 1)
		partition, perGroup = eraYearExpr, max((want+years-1)/years, 1)
	}
	inner, err := r.songs("mf.id", eraYearExpr+" AS year", "mf.artist_id", "lower(mf.title) AS title")
	if err != nil {
		return nil, err
	}
	inner = inner.Column("row_number() OVER (PARTITION BY " + partition + " ORDER BY random()) AS rn").
		Where(eraYears(opts.From, opts.To))
	if opts.Genre != "" {
		inner = inner.Where(Eq{"lower(mf.genre)": strings.ToLower(opts.Genre)})
	}
	if len(opts.LibraryIDs) > 0 {
		inner = inner.Where(Eq{"mf.library_id": opts.LibraryIDs})
	}
	if opts.Unplayed {
		inner = inner.Where("coalesce(a.play_count, 0) = 0")
	}
	// Twice as many as needed, as the same song can be on several iPods
	sq := Select("id", "year", "artist_id", "title").FromSelect(inner, "picks").
		Where(LtOrEq{"rn": perGroup}).OrderBy("random()").Limit(uint64(want * 2))
	var picks []dbEraPick
	if err := ignoreNotFound(r.queryAll(sq, &picks)); err != nil {
		return nil, err
	}
	picks = pickEraSongs(picks, want, opts.Journey)

	ids := slice.Map(picks, func(p dbEraPick) string { return p.ID })
	if len(ids) == 0 {
		return model.MediaFiles{}, nil
	}
	songs, err := NewMediaFileRepository(r.ctx, r.db).GetAll(model.QueryOptions{Filters: Eq{"media_file.id": ids}})
	if err != nil {
		return nil, err
	}
	order := make(map[string]int, len(ids))
	for i, id := range ids {
		order[id] = i
	}
	slices.SortFunc(songs, func(a, b model.MediaFile) int { return order[a.ID] - order[b.ID] })
	return songs, nil
}

// pickEraSongs keeps each song once (by artist and title), up to want songs, in the order they came
// out for a journey (shuffled within each year)
func pickEraSongs(picks []dbEraPick, want int, journey bool) []dbEraPick {
	seen := map[string]bool{}
	var res []dbEraPick
	for _, p := range picks {
		key := p.Artist + "\x00" + p.Title
		if seen[key] {
			continue
		}
		seen[key] = true
		res = append(res, p)
	}
	if journey && len(res) > want {
		// Keep the same share of each year
		res = evenlySpread(res, want)
	}
	if len(res) > want {
		res = res[:want]
	}
	if journey {
		rand.Shuffle(len(res), func(i, j int) { res[i], res[j] = res[j], res[i] })
		slices.SortStableFunc(res, func(a, b dbEraPick) int { return a.Year - b.Year })
	}
	return res
}

// evenlySpread keeps want songs, taking one from each year in turn
func evenlySpread(picks []dbEraPick, want int) []dbEraPick {
	byYear := map[int][]dbEraPick{}
	var years []int
	for _, p := range picks {
		if _, ok := byYear[p.Year]; !ok {
			years = append(years, p.Year)
		}
		byYear[p.Year] = append(byYear[p.Year], p)
	}
	slices.Sort(years)
	// With more years than songs, take years spread over the whole stretch, not just the first ones
	if len(years) > want {
		spread := make([]int, want)
		for i := range spread {
			spread[i] = years[i*len(years)/want]
		}
		years = spread
	}
	var res []dbEraPick
	for round := 0; len(res) < want; round++ {
		added := false
		for _, y := range years {
			if round < len(byYear[y]) && len(res) < want {
				res = append(res, byYear[y][round])
				added = true
			}
		}
		if !added {
			break
		}
	}
	return res
}
