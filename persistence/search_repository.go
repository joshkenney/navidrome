package persistence

import (
	"context"
	"strings"

	. "github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/model"
	"github.com/pocketbase/dbx"
)

// minExtraFieldsQuery is the shortest query also looked for in comments, lyrics and record labels, which
// can't use the full-text index
const minExtraFieldsQuery = 3

type searchRepository struct {
	ctx context.Context
	db  dbx.Builder
}

func NewSearchRepository(ctx context.Context, db dbx.Builder) model.SearchRepository {
	return &searchRepository{ctx: ctx, db: db}
}

func searchQuery(opts model.SearchOptions) string {
	return strings.ToLower(strings.TrimSpace(opts.Query))
}

// hasFilters tells if a search without words should still return results
func hasFilters(opts model.SearchOptions) bool {
	return opts.YearFrom > 0 || opts.YearTo > 0 || opts.GenreID != "" || opts.Played != ""
}

// textMatch matches the words of the query in a table's full-text index, and with long enough queries
// also in the given extra fields. It returns nil when nothing can match
func textMatch(table, q string, extra ...Sqlizer) Sqlizer {
	if q == "" {
		return And{}
	}
	var res Or
	if ft := fullTextFilter(table)("", q); ft != nil {
		res = append(res, ft)
	}
	if len([]rune(q)) >= minExtraFieldsQuery {
		res = append(res, extra...)
	}
	if len(res) == 0 {
		return nil
	}
	return res
}

func likeField(field, q string) Sqlizer {
	return Like{"lower(" + field + ")": "%" + q + "%"}
}

// labelMatch matches a record label in a table's tags
func labelMatch(table, q string) Sqlizer {
	return Expr("EXISTS (SELECT 1 FROM json_tree("+table+".tags, '$."+string(model.TagRecordLabel)+"') "+
		"WHERE key = 'value' AND lower(value) LIKE ?)", "%"+q+"%")
}

func playedFilter(played string) Sqlizer {
	switch played {
	case model.SearchPlayed:
		return Gt{"coalesce(annotation.play_count, 0)": 0}
	case model.SearchUnplayed:
		return Eq{"coalesce(annotation.play_count, 0)": 0}
	}
	return And{}
}

// albumYearFilter keeps albums with a release in the years searched
func albumYearFilter(table string, opts model.SearchOptions) Sqlizer {
	res := And{}
	if opts.YearFrom > 0 {
		res = append(res, GtOrEq{table + ".max_year": opts.YearFrom})
	}
	if opts.YearTo > 0 {
		res = append(res, LtOrEq{"coalesce(nullif(" + table + ".min_year, 0), " + table + ".max_year)": opts.YearTo})
	}
	return res
}

// rankBy orders exact names first, then names starting with the query, then the rest
func rankBy(sq SelectBuilder, field, q string) SelectBuilder {
	if q == "" {
		return sq
	}
	return sq.OrderByClause("CASE WHEN lower("+field+") = ? THEN 0 WHEN lower("+field+") LIKE ? THEN 1 "+
		"WHEN lower("+field+") LIKE ? THEN 2 ELSE 3 END", q, q+"%", "%"+q+"%")
}

func page(sq SelectBuilder, opts model.SearchOptions) SelectBuilder {
	sq = sq.Limit(uint64(max(opts.Max, 1)))
	if opts.Offset > 0 {
		sq = sq.Offset(uint64(opts.Offset))
	}
	return sq
}

func (r *searchRepository) Songs(opts model.SearchOptions) (model.MediaFiles, error) {
	q := searchQuery(opts)
	if q == "" && !hasFilters(opts) {
		return model.MediaFiles{}, nil
	}
	match := textMatch("media_file", q,
		likeField("media_file.comment", q), likeField("media_file.lyrics", q), labelMatch("media_file", q))
	if match == nil {
		return model.MediaFiles{}, nil
	}
	repo := NewMediaFileRepository(r.ctx, r.db).(*mediaFileRepository)
	sq := repo.selectMediaFile().
		Where(Eq{"media_file.missing": false}).
		Where(match).
		Where(playedFilter(opts.Played))
	if len(opts.LibraryIDs) > 0 {
		sq = sq.Where(Eq{"media_file.library_id": opts.LibraryIDs})
	}
	if opts.YearFrom > 0 {
		sq = sq.Where(GtOrEq{"media_file.year": opts.YearFrom})
	}
	if opts.YearTo > 0 {
		sq = sq.Where(And{Gt{"media_file.year": 0}, LtOrEq{"media_file.year": opts.YearTo}})
	}
	if opts.GenreID != "" {
		sq = sq.Where(tagIDFilter("genre", opts.GenreID))
	}
	sq = rankBy(sq, "media_file.title", q).OrderBy("media_file.order_title", "media_file.library_id")
	var res dbMediaFiles
	if err := ignoreNotFound(repo.queryAll(page(sq, opts), &res)); err != nil {
		return nil, err
	}
	return res.toModels(), nil
}

func (r *searchRepository) Albums(opts model.SearchOptions) (model.Albums, error) {
	q := searchQuery(opts)
	if q == "" && !hasFilters(opts) {
		return model.Albums{}, nil
	}
	match := textMatch("album", q, likeField("album.comment", q), labelMatch("album", q))
	if match == nil {
		return model.Albums{}, nil
	}
	repo := NewAlbumRepository(r.ctx, r.db).(*albumRepository)
	sq := repo.selectAlbum().
		Where(Eq{"album.missing": false}).
		Where(match).
		Where(playedFilter(opts.Played)).
		Where(albumYearFilter("album", opts))
	if len(opts.LibraryIDs) > 0 {
		sq = sq.Where(Eq{"album.library_id": opts.LibraryIDs})
	}
	if opts.GenreID != "" {
		sq = sq.Where(tagIDFilter("genre", opts.GenreID))
	}
	sq = rankBy(sq, "album.name", q).OrderBy("album.order_album_name", "album.library_id")
	var res dbAlbums
	if err := ignoreNotFound(repo.queryAll(page(sq, opts), &res)); err != nil {
		return nil, err
	}
	return res.toModels(), nil
}

func (r *searchRepository) Artists(opts model.SearchOptions) (model.Artists, error) {
	q := searchQuery(opts)
	if q == "" && !hasFilters(opts) {
		return model.Artists{}, nil
	}
	match := textMatch("artist", q)
	if match == nil {
		return model.Artists{}, nil
	}
	repo := NewArtistRepository(r.ctx, r.db).(*artistRepository)
	sq := repo.selectArtist().
		Where(Eq{"artist.missing": false}).
		Where(match).
		Where(playedFilter(opts.Played))
	if len(opts.LibraryIDs) > 0 {
		sq = sq.Where(Eq{"library_artist.library_id": opts.LibraryIDs})
	}
	// Artists have no year or genre of their own, so they are kept when one of their albums has them
	if opts.YearFrom > 0 || opts.YearTo > 0 || opts.GenreID != "" {
		albums := And{Expr("al.album_artist_id = artist.id"), Eq{"al.missing": false}, albumYearFilter("al", opts)}
		if opts.GenreID != "" {
			albums = append(albums, Expr(`EXISTS (SELECT 1 FROM json_tree(al.tags, "$.genre") jt `+
				`WHERE jt.atom IS NOT NULL AND jt.value = ?)`, opts.GenreID))
		}
		sql, args, err := albums.ToSql()
		if err != nil {
			return nil, err
		}
		sq = sq.Where("EXISTS (SELECT 1 FROM album al WHERE "+sql+")", args...)
	}
	sq = rankBy(sq, "artist.name", q).OrderBy("artist.order_artist_name")
	var res dbArtists
	if err := ignoreNotFound(repo.queryAll(page(sq, opts), &res)); err != nil {
		return nil, err
	}
	return res.toModels(), nil
}
