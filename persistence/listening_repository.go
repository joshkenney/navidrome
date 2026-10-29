package persistence

import (
	"context"
	"strings"
	"time"

	. "github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/slice"
	"github.com/pocketbase/dbx"
)

type listeningRepository struct {
	ipodRepository
}

func NewListeningRepository(ctx context.Context, db dbx.Builder) model.ListeningRepository {
	r := &listeningRepository{}
	r.ctx = ctx
	r.db = db
	r.tableName = "media_file"
	return r
}

// dayExpr is the listener's local day of a scrobble. The offset (in seconds) is its first argument
const dayExpr = "date(s.submission_time + ?, 'unixepoch')"

// scrobbles returns a select over a user's scrobbles of songs the current user can access, between two
// times (unbounded when zero)
func (r *listeningRepository) scrobbles(userID string, from, to time.Time, columns ...string) (SelectBuilder, error) {
	combined, err := r.combinedLibraryIDs()
	if err != nil {
		return SelectBuilder{}, err
	}
	sq := Select(columns...).From("scrobbles s").
		Join("media_file mf ON mf.id = s.media_file_id").
		Where(Eq{"s.user_id": userID})
	if !from.IsZero() {
		sq = sq.Where(GtOrEq{"s.submission_time": from.Unix()})
	}
	if !to.IsZero() {
		sq = sq.Where(Lt{"s.submission_time": to.Unix()})
	}
	if len(combined) > 0 {
		sq = sq.Where(NotEq{"mf.library_id": combined})
	}
	return r.applyLibraryFilter(sq, "mf"), nil
}

type dbListeningDay struct {
	Date    string  `db:"day"`
	Plays   int     `db:"plays"`
	Seconds float64 `db:"seconds"`
}

func (r *listeningRepository) days(userID string, from, to time.Time, tzOffset int) ([]model.ListeningDay, error) {
	sq, err := r.scrobbles(userID, from, to, "count(*) AS plays", "coalesce(sum(mf.duration), 0) AS seconds")
	if err != nil {
		return nil, err
	}
	sq = sq.Column(Expr(dayExpr+" AS day", tzOffset*60)).GroupBy("day").OrderBy("day")
	var rows []dbListeningDay
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(d dbListeningDay) model.ListeningDay {
		return model.ListeningDay{Date: d.Date, Plays: d.Plays, Seconds: d.Seconds}
	}), nil
}

type dbListeningCount struct {
	ID          string `db:"id"`
	Name        string `db:"name"`
	Artist      string `db:"artist"`
	ArtistID    string `db:"artist_id"`
	AlbumID     string `db:"album_id"`
	LibraryID   int    `db:"library_id"`
	LibraryName string `db:"library_name"`
	UpdatedAt   string `db:"updated_at"`
	Plays       int    `db:"plays"`
	LastPlayed  int64  `db:"last_played"`
	Songs       int    `db:"songs"`
	Ipods       int    `db:"ipods"`
}

func (c dbListeningCount) toModel() model.ListeningCount {
	res := model.ListeningCount{
		ID: c.ID, Name: c.Name, Artist: c.Artist, ArtistID: c.ArtistID, AlbumID: c.AlbumID,
		LibraryID: c.LibraryID, LibraryName: c.LibraryName, Plays: c.Plays, Songs: c.Songs, Ipods: c.Ipods,
	}
	if c.LastPlayed > 0 {
		res.LastPlayed = time.Unix(c.LastPlayed, 0)
	}
	res.UpdatedAt = parseDBTime(c.UpdatedAt)
	return res
}

// parseDBTime reads a time stored by SQLite as text, returning zero when it can't
func parseDBTime(s string) time.Time {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05.999999999-07:00", "2006-01-02 15:04:05.999999999", "2006-01-02 15:04:05"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

func (r *listeningRepository) top(sq SelectBuilder, limit int, groupBy string, columns ...string) ([]model.ListeningCount, error) {
	sq = sq.Columns(columns...).
		Columns("count(*) AS plays", "max(s.submission_time) AS last_played").
		GroupBy(groupBy).OrderBy("plays DESC", "last_played DESC").Limit(uint64(limit))
	var rows []dbListeningCount
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, dbListeningCount.toModel), nil
}

func (r *listeningRepository) Timeline(userID string, opts model.TimelineOptions) (*model.Timeline, error) {
	res := &model.Timeline{}
	var err error
	if res.Days, err = r.days(userID, opts.From, opts.To, opts.TZOffset); err != nil {
		return nil, err
	}

	base, err := r.scrobbles(userID, opts.From, opts.To)
	if err != nil {
		return nil, err
	}
	var totals struct {
		Plays   int     `db:"plays"`
		Seconds float64 `db:"seconds"`
		Songs   int     `db:"songs"`
		Albums  int     `db:"albums"`
		Artists int     `db:"artists"`
	}
	err = r.queryOne(base.Columns("count(*) AS plays", "coalesce(sum(mf.duration), 0) AS seconds",
		"count(DISTINCT mf.id) AS songs", "count(DISTINCT mf.album_id) AS albums",
		"count(DISTINCT mf.artist_id) AS artists"), &totals)
	if ignoreNotFound(err) != nil {
		return nil, err
	}
	res.Totals = model.ListeningTotals(totals)
	if res.Totals.Plays == 0 {
		return res, r.bounds(userID, res)
	}

	const topLimit = 10
	if res.TopArtists, err = r.top(base, topLimit, "mf.artist_id",
		"mf.artist_id AS id", "mf.artist AS name"); err != nil {
		return nil, err
	}
	if res.TopAlbums, err = r.top(base.Join("library l ON l.id = mf.library_id"), topLimit, "mf.album_id",
		"mf.album_id AS id", "mf.album AS name", "mf.album_artist AS artist", "mf.album_artist_id AS artist_id",
		"mf.album_id", "mf.library_id", "l.name AS library_name", "max(mf.updated_at) AS updated_at"); err != nil {
		return nil, err
	}
	if res.TopSongs, err = r.top(base.Join("library l ON l.id = mf.library_id"), topLimit, "mf.id",
		"mf.id", "mf.title AS name", "mf.artist", "mf.artist_id", "mf.album_id", "mf.library_id",
		"l.name AS library_name", "mf.updated_at"); err != nil {
		return nil, err
	}
	if res.TopIpods, err = r.top(base.Join("library l ON l.id = mf.library_id"), topLimit, "mf.library_id",
		"cast(mf.library_id AS text) AS id", "l.name AS name", "mf.library_id", "l.name AS library_name"); err != nil {
		return nil, err
	}

	filtered := base
	if len(opts.ArtistIDs) > 0 {
		filtered = filtered.Where(Eq{"mf.artist_id": opts.ArtistIDs})
	}
	if len(opts.LibraryIDs) > 0 {
		filtered = filtered.Where(Eq{"mf.library_id": opts.LibraryIDs})
	}
	var count struct {
		Plays int `db:"plays"`
	}
	if err := ignoreNotFound(r.queryOne(filtered.Columns("count(*) AS plays"), &count)); err != nil {
		return nil, err
	}
	res.FilteredPlays = count.Plays

	plays := filtered.Join("library l ON l.id = mf.library_id").Columns(
		"s.user_id", "s.submission_time",
		"mf.id AS media_file_id", "mf.title", "mf.artist", "mf.album",
		"mf.album_id", "mf.artist_id", "mf.album_artist_id",
		"mf.duration", "mf.updated_at",
		"mf.library_id", "l.name AS library_name",
	).OrderBy("s.submission_time DESC").Limit(uint64(max(opts.Max, 1))).Offset(uint64(max(opts.Offset, 0)))
	var rows []dbScrobbleEntry
	if err := ignoreNotFound(r.queryAll(plays, &rows)); err != nil {
		return nil, err
	}
	res.Plays = slice.Map(rows, dbScrobbleEntry.toModel)
	return res, r.bounds(userID, res)
}

type dbListenerArtistPlays struct {
	UserID     string `db:"user_id"`
	UserName   string `db:"user_name"`
	Name       string `db:"name"`
	ArtistID   string `db:"artist_id"`
	ArtistName string `db:"artist_name"`
	Plays      int    `db:"plays"`
}

func (r *listeningRepository) ListenerArtists(since time.Time) ([]model.ListenerArtistPlays, error) {
	combined, err := r.combinedLibraryIDs()
	if err != nil {
		return nil, err
	}
	sq := Select("s.user_id", "u.user_name", "u.name", "mf.artist_id", "min(mf.artist) AS artist_name",
		"count(*) AS plays").
		From("scrobbles s").
		Join("media_file mf ON mf.id = s.media_file_id").
		Join("user u ON u.id = s.user_id").
		Where(r.sharingOrMe()).
		Where(GtOrEq{"s.submission_time": since.Unix()}).
		Where(NotEq{"mf.artist_id": []string{"", consts.VariousArtistsID, consts.UnknownArtistID}}).
		GroupBy("s.user_id", "mf.artist_id")
	if len(combined) > 0 {
		sq = sq.Where(NotEq{"mf.library_id": combined})
	}
	sq = r.applyLibraryFilter(sq, "mf")
	var rows []dbListenerArtistPlays
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(p dbListenerArtistPlays) model.ListenerArtistPlays {
		return model.ListenerArtistPlays(p)
	}), nil
}

func (r *listeningRepository) TopSongsOf(userID, artistID string, since time.Time, limit int) ([]model.ListeningCount, error) {
	base, err := r.scrobbles(userID, since, time.Time{})
	if err != nil {
		return nil, err
	}
	return r.top(base.Where(Eq{"mf.artist_id": artistID}).Join("library l ON l.id = mf.library_id"), limit, "mf.id",
		"mf.id", "mf.title AS name", "mf.artist", "mf.artist_id", "mf.album_id", "mf.library_id",
		"l.name AS library_name", "mf.updated_at")
}

// bounds sets the times of the user's first and last plays ever
func (r *listeningRepository) bounds(userID string, res *model.Timeline) error {
	sq, err := r.scrobbles(userID, time.Time{}, time.Time{},
		"coalesce(min(s.submission_time), 0) AS first", "coalesce(max(s.submission_time), 0) AS last")
	if err != nil {
		return err
	}
	var b struct {
		First int64 `db:"first"`
		Last  int64 `db:"last"`
	}
	if err := ignoreNotFound(r.queryOne(sq, &b)); err != nil {
		return err
	}
	if b.First > 0 {
		res.First, res.Last = time.Unix(b.First, 0), time.Unix(b.Last, 0)
	}
	return nil
}

// playedExpr is 1 when the current user has played the item joined as "a"
const playedExpr = "CASE WHEN coalesce(a.play_count, 0) > 0 THEN 1 ELSE 0 END"

func (r *listeningRepository) Holes(opts model.HolesOptions) (*model.Holes, error) {
	userID := loggedUser(r.ctx).ID
	limit := max(opts.Max, 1)
	res := &model.Holes{}
	var err error

	songs := func(columns ...string) (SelectBuilder, error) {
		sq, err := r.mediaFiles(columns...)
		if err != nil {
			return sq, err
		}
		return sq.LeftJoin("annotation a ON a.item_id = mf.id AND a.item_type = 'media_file' AND a.user_id = ?", userID), nil
	}

	// How much of each iPod has been played
	sq, err := songs("cast(mf.library_id AS text) AS id", "l.name AS name", "mf.library_id", "l.name AS library_name",
		"count(*) AS total", "sum("+playedExpr+") AS played")
	if err != nil {
		return nil, err
	}
	sq = sq.Join("library l ON l.id = mf.library_id").GroupBy("mf.library_id").
		OrderBy("cast(played AS real) / total", "total DESC")
	if res.Ipods, err = r.coverage(sq); err != nil {
		return nil, err
	}

	// How much of each decade has been played
	if sq, err = songs("cast((mf.year / 10) * 10 AS text) AS id", "cast((mf.year / 10) * 10 AS text) || 's' AS name",
		"count(*) AS total", "sum("+playedExpr+") AS played"); err != nil {
		return nil, err
	}
	sq = sq.Where(Gt{"mf.year": 0}).GroupBy("(mf.year / 10) * 10").OrderBy("id")
	if res.Decades, err = r.coverage(sq); err != nil {
		return nil, err
	}

	// How many of each genre's albums have been played
	if res.Genres, err = r.genreCoverage(userID, limit); err != nil {
		return nil, err
	}

	// Artists never played, with the most songs first
	if sq, err = songs("mf.album_artist_id AS id", "mf.album_artist AS name", "count(*) AS songs"); err != nil {
		return nil, err
	}
	sq = sq.Where(NotEq{"mf.album_artist_id": []string{consts.VariousArtistsID, consts.UnknownArtistID, ""}}).
		GroupBy("mf.album_artist_id").Having("sum(" + playedExpr + ") = 0").
		OrderBy("songs DESC").Limit(uint64(limit))
	if res.Artists, err = r.counts(sq); err != nil {
		return nil, err
	}

	// Albums never played, found on the most iPods first
	if sq, err = songs("min(mf.album_id) AS id", "mf.album AS name", "mf.album_artist AS artist",
		"mf.album_artist_id AS artist_id", "min(mf.album_id) AS album_id", "min(mf.library_id) AS library_id",
		"max(mf.updated_at) AS updated_at", "count(DISTINCT mf.library_id) AS ipods", "count(*) AS songs"); err != nil {
		return nil, err
	}
	sq = sq.Where(NotEq{"mf.album": ""}).
		GroupBy("mf.album_artist_id", "lower(mf.album)").Having("sum("+playedExpr+") = 0").
		OrderBy("ipods DESC", "songs DESC").Limit(uint64(limit))
	if res.Albums, err = r.counts(sq); err != nil {
		return nil, err
	}
	if err = r.fillLibraryNames(res.Albums); err != nil {
		return nil, err
	}

	if err = r.forgotten(userID, opts.ForgottenBefore, limit, res); err != nil {
		return nil, err
	}
	if res.Community, err = r.community(userID, limit); err != nil {
		return nil, err
	}
	if res.Days, err = r.days(userID, time.Time{}, time.Time{}, opts.TZOffset); err != nil {
		return nil, err
	}
	return res, nil
}

type dbCoverage struct {
	ID          string `db:"id"`
	Name        string `db:"name"`
	LibraryID   int    `db:"library_id"`
	LibraryName string `db:"library_name"`
	Total       int    `db:"total"`
	Played      int    `db:"played"`
}

func (r *listeningRepository) coverage(sq SelectBuilder) ([]model.Coverage, error) {
	var rows []dbCoverage
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(c dbCoverage) model.Coverage { return model.Coverage(c) }), nil
}

func (r *listeningRepository) counts(sq SelectBuilder) ([]model.ListeningCount, error) {
	var rows []dbListeningCount
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, dbListeningCount.toModel), nil
}

func (r *listeningRepository) fillLibraryNames(items []model.ListeningCount) error {
	var libs model.Libraries
	if err := ignoreNotFound(r.queryAll(Select("id", "name").From("library"), &libs)); err != nil {
		return err
	}
	names := make(map[int]string, len(libs))
	for _, l := range libs {
		names[l.ID] = l.Name
	}
	for i := range items {
		items[i].LibraryName = names[items[i].LibraryID]
	}
	return nil
}

// genreCoverage counts, for each genre, its albums and how many of them the user has played. Genres
// with the fewest played albums come first
func (r *listeningRepository) genreCoverage(userID string, limit int) ([]model.Coverage, error) {
	combined, err := r.combinedLibraryIDs()
	if err != nil {
		return nil, err
	}
	sq := Select("json_extract(g.value, '$.id') AS id", "json_extract(g.value, '$.value') AS name",
		"count(DISTINCT al.id) AS total",
		"count(DISTINCT CASE WHEN coalesce(a.play_count, 0) > 0 THEN al.id END) AS played").
		From("album al").
		Join("json_each(al.tags, '$.genre') g").
		LeftJoin("annotation a ON a.item_id = al.id AND a.item_type = 'album' AND a.user_id = ?", userID).
		Where(Eq{"al.missing": false}).
		GroupBy("lower(json_extract(g.value, '$.value'))").
		OrderBy("cast(played AS real) / total", "total DESC").
		Limit(uint64(limit * 2))
	if len(combined) > 0 {
		sq = sq.Where(NotEq{"al.library_id": combined})
	}
	sq = r.applyLibraryFilter(sq, "al")
	return r.coverage(sq)
}

// minForgottenPlays is how many plays make something a favourite that can be forgotten
var minForgottenPlays = map[string]int{"artist": 10, "album": 10, "media_file": 5}

func (r *listeningRepository) forgotten(userID string, before time.Time, limit int, res *model.Holes) error {
	if before.IsZero() {
		before = time.Now().AddDate(0, -6, 0)
	}
	query := func(itemType string, columns ...string) SelectBuilder {
		return Select(columns...).Columns("a.play_count AS plays", "cast(strftime('%s', a.play_date) AS integer) AS last_played").
			From("annotation a").
			Where(Eq{"a.user_id": userID, "a.item_type": itemType}).
			Where(GtOrEq{"a.play_count": minForgottenPlays[itemType]}).
			Where("cast(strftime('%s', a.play_date) AS integer) < ?", before.Unix()).
			OrderBy("a.play_count DESC").Limit(uint64(limit))
	}
	var err error
	if res.ForgottenArtist, err = r.counts(query("artist", "ar.id", "ar.name").
		Join("artist ar ON ar.id = a.item_id").Where(Eq{"ar.missing": false})); err != nil {
		return err
	}
	albums := query("album", "al.id", "al.name", "al.album_artist AS artist", "al.album_artist_id AS artist_id",
		"al.id AS album_id", "al.library_id", "l.name AS library_name", "al.updated_at").
		Join("album al ON al.id = a.item_id").Join("library l ON l.id = al.library_id").
		Where(Eq{"al.missing": false})
	if res.ForgottenAlbums, err = r.counts(r.applyLibraryFilter(albums, "al")); err != nil {
		return err
	}
	songs := query("media_file", "mf.id", "mf.title AS name", "mf.artist", "mf.artist_id", "mf.album_id",
		"mf.library_id", "l.name AS library_name", "mf.updated_at").
		Join("media_file mf ON mf.id = a.item_id").Join("library l ON l.id = mf.library_id").
		Where(Eq{"mf.missing": false})
	res.ForgottenSongs, err = r.counts(r.applyLibraryFilter(songs, "mf"))
	return err
}

type dbCommunityArtist struct {
	ID        string `db:"id"`
	Name      string `db:"name"`
	Listeners string `db:"listeners"`
	Plays     int    `db:"plays"`
	Songs     int    `db:"songs"`
}

// community finds artists that listeners sharing their activity play, that the user never has and can
// listen to, with the most listeners first
func (r *listeningRepository) community(userID string, limit int) ([]model.CommunityArtist, error) {
	sq := Select("ar.id", "ar.name", "group_concat(DISTINCT u.user_name) AS listeners",
		"sum(a.play_count) AS plays",
		"(SELECT count(*) FROM media_file m WHERE m.artist_id = ar.id AND m.missing = 0) AS songs").
		From("annotation a").
		Join("user u ON u.id = a.user_id").
		Join("artist ar ON ar.id = a.item_id").
		Where(Eq{"a.item_type": "artist", "u.share_activity": true, "ar.missing": false}).
		Where(NotEq{"a.user_id": userID}).
		Where(Gt{"a.play_count": 0}).
		Where(NotEq{"ar.id": []string{consts.VariousArtistsID, consts.UnknownArtistID}}).
		Where("NOT EXISTS (SELECT 1 FROM annotation mine WHERE mine.item_id = ar.id AND mine.user_id = ? "+
			"AND mine.item_type = 'artist' AND mine.play_count > 0)", userID).
		GroupBy("ar.id").
		OrderBy("count(DISTINCT a.user_id) DESC", "plays DESC").
		Limit(uint64(limit))
	if user := loggedUser(r.ctx); !user.IsAdmin {
		sq = sq.Where("EXISTS (SELECT 1 FROM library_artist la JOIN user_library ul ON ul.library_id = la.library_id "+
			"WHERE la.artist_id = ar.id AND ul.user_id = ?)", user.ID)
	}
	var rows []dbCommunityArtist
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(c dbCommunityArtist) model.CommunityArtist {
		return model.CommunityArtist{
			ID: c.ID, Name: c.Name, Plays: c.Plays, Songs: c.Songs,
			Listeners: strings.Split(c.Listeners, ","),
		}
	}), nil
}

// sharingOrMe limits a user query to listeners who share their activity, and the current user
func (r *listeningRepository) sharingOrMe() Sqlizer {
	return Or{Eq{"u.share_activity": true}, Eq{"u.id": loggedUser(r.ctx).ID}}
}

type dbListeningUser struct {
	ID         string `db:"id"`
	UserName   string `db:"user_name"`
	Name       string `db:"name"`
	Plays      int    `db:"plays"`
	LastPlayed int64  `db:"last_played"`
}

func (r *listeningRepository) SearchUsers(q string, limit int) ([]model.ListeningUser, error) {
	like := "%" + strings.ToLower(strings.TrimSpace(q)) + "%"
	sq := Select("u.id", "u.user_name", "u.name",
		"(SELECT count(*) FROM scrobbles s WHERE s.user_id = u.id) AS plays",
		"coalesce((SELECT max(s.submission_time) FROM scrobbles s WHERE s.user_id = u.id), 0) AS last_played").
		From("user u").
		Where(r.sharingOrMe()).
		Where(Or{Like{"lower(u.user_name)": like}, Like{"lower(u.name)": like}}).
		OrderBy("last_played DESC").
		Limit(uint64(limit))
	var rows []dbListeningUser
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(u dbListeningUser) model.ListeningUser {
		res := model.ListeningUser{ID: u.ID, UserName: u.UserName, Name: u.Name, Plays: u.Plays}
		if u.LastPlayed > 0 {
			res.LastPlayed = time.Unix(u.LastPlayed, 0)
		}
		return res
	}), nil
}

type dbListenMatch struct {
	dbScrobbleEntry
	Plays int `db:"plays"`
}

func (r *listeningRepository) SearchListens(q string, limit int) ([]model.ListenMatch, error) {
	like := "%" + strings.ToLower(strings.TrimSpace(q)) + "%"
	sq := Select(
		"s.user_id", "u.user_name", "max(s.submission_time) AS submission_time", "count(*) AS plays",
		"mf.id AS media_file_id", "mf.title", "mf.artist", "mf.album",
		"mf.album_id", "mf.artist_id", "mf.album_artist_id",
		"mf.duration", "mf.updated_at",
		"mf.library_id", "l.name AS library_name",
	).From("scrobbles s").
		Join("user u ON u.id = s.user_id").
		Join("media_file mf ON mf.id = s.media_file_id").
		Join("library l ON l.id = mf.library_id").
		Where(r.sharingOrMe()).
		Where(Or{Like{"lower(mf.title)": like}, Like{"lower(mf.artist)": like}, Like{"lower(mf.album)": like}}).
		GroupBy("s.user_id", "mf.id").
		OrderBy("submission_time DESC").
		Limit(uint64(limit))
	sq = r.applyLibraryFilter(sq, "mf")
	var rows []dbListenMatch
	if err := ignoreNotFound(r.queryAll(sq, &rows)); err != nil {
		return nil, err
	}
	return slice.Map(rows, func(m dbListenMatch) model.ListenMatch {
		return model.ListenMatch{ListenEntry: m.toModel(), Plays: m.Plays}
	}), nil
}
