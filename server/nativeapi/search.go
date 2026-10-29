package nativeapi

import (
	"net/http"
	"slices"
	"strings"

	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/req"
	"golang.org/x/sync/errgroup"
)

const (
	searchDefaultLimit = 5
	searchMaxLimit     = 100
)

var searchTypes = []string{"artists", "albums", "songs", "users", "listens"}

// searchGroup is one kind of result. More tells if there are results past this page. Matches says,
// for results found outside their name (in a comment, the lyrics or the record label), where
type searchGroup[T any] struct {
	Items   []T               `json:"items"`
	More    bool              `json:"more"`
	Matches map[string]string `json:"matches,omitempty"`
}

type listenResult struct {
	activityEntry
	Plays int `json:"plays"`
}

type searchResponse struct {
	Artists *searchGroup[model.Artist]        `json:"artists,omitempty"`
	Albums  *searchGroup[model.Album]         `json:"albums,omitempty"`
	Songs   *searchGroup[model.MediaFile]     `json:"songs,omitempty"`
	Users   *searchGroup[model.ListeningUser] `json:"users,omitempty"`
	Listens *searchGroup[listenResult]        `json:"listens,omitempty"`
}

// newSearchGroup keeps the first limit items, out of limit+1 asked for to know if there are more
func newSearchGroup[T any](items []T, limit int) *searchGroup[T] {
	g := &searchGroup[T]{Items: items}
	if g.Items == nil {
		g.Items = []T{}
	}
	if len(g.Items) > limit {
		g.Items, g.More = g.Items[:limit], true
	}
	return g
}

func containsFold(q string, fields ...string) bool {
	for _, f := range fields {
		if strings.Contains(strings.ToLower(f), q) {
			return true
		}
	}
	return false
}

// extraMatch tells where a result was found when its name doesn't contain the query
func extraMatch(q string, names []string, comment, lyrics string, tags model.Tags) string {
	switch {
	case q == "" || containsFold(q, names...):
		return ""
	case containsFold(q, tags[model.TagRecordLabel]...):
		return "label"
	case containsFold(q, comment):
		return "comment"
	case containsFold(q, lyrics):
		return "lyrics"
	}
	return ""
}

func songMatches(q string, songs model.MediaFiles) map[string]string {
	res := map[string]string{}
	for _, s := range songs {
		names := append([]string{s.Title, s.Artist, s.Album, s.AlbumArtist}, s.Participants.AllNames()...)
		if m := extraMatch(q, names, s.Comment, s.Lyrics, s.Tags); m != "" {
			res[s.ID] = m
		} else if !containsFold(q, s.Title, s.Artist, s.Album, s.AlbumArtist) && containsFold(q, s.Participants.AllNames()...) {
			res[s.ID] = "credits"
		}
	}
	return res
}

func albumMatches(q string, albums model.Albums) map[string]string {
	res := map[string]string{}
	for _, a := range albums {
		if m := extraMatch(q, []string{a.Name, a.AlbumArtist}, a.Comment, "", a.Tags); m != "" {
			res[a.ID] = m
		}
	}
	return res
}

// search looks for artists, albums and songs (also in comments, lyrics, credits and record labels),
// listeners, and what listeners have played. Filters: library_id (repeatable), year_from, year_to,
// genre_id and played ("played" or "unplayed"). "types" picks the groups, paged with _start and _end
func (api *Router) search(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p := req.Params(r)
	q := strings.TrimSpace(p.StringOr("q", ""))
	types, _ := p.Strings("types")
	if len(types) == 1 && strings.Contains(types[0], ",") {
		types = strings.Split(types[0], ",")
	}
	if len(types) == 0 {
		types = searchTypes
	}
	libraryIDs, _ := p.Ints("library_id")
	offset := max(p.IntOr("_start", 0), 0)
	limit := min(max(p.IntOr("_end", offset+searchDefaultLimit)-offset, 1), searchMaxLimit)
	opts := model.SearchOptions{
		Query:      q,
		LibraryIDs: libraryIDs,
		YearFrom:   p.IntOr("year_from", 0),
		YearTo:     p.IntOr("year_to", 0),
		GenreID:    p.StringOr("genre_id", ""),
		Played:     p.StringOr("played", ""),
		Offset:     offset,
		Max:        limit + 1,
	}
	lowerQ := strings.ToLower(q)
	// Listeners and their plays are found by name only, not by the filters
	byName := q != "" && opts.YearFrom == 0 && opts.YearTo == 0 && opts.GenreID == "" && opts.Played == "" && len(libraryIDs) == 0

	var resp searchResponse
	var g errgroup.Group
	if slices.Contains(types, "artists") {
		g.Go(func() error {
			artists, err := api.ds.Search(ctx).Artists(opts)
			resp.Artists = newSearchGroup(artists, limit)
			return err
		})
	}
	if slices.Contains(types, "albums") {
		g.Go(func() error {
			albums, err := api.ds.Search(ctx).Albums(opts)
			resp.Albums = newSearchGroup(albums, limit)
			resp.Albums.Matches = albumMatches(lowerQ, resp.Albums.Items)
			return err
		})
	}
	if slices.Contains(types, "songs") {
		g.Go(func() error {
			songs, err := api.ds.Search(ctx).Songs(opts)
			resp.Songs = newSearchGroup(songs, limit)
			resp.Songs.Matches = songMatches(lowerQ, resp.Songs.Items)
			for i := range resp.Songs.Items {
				resp.Songs.Items[i].Lyrics = ""
			}
			return err
		})
	}
	if slices.Contains(types, "users") && byName && offset == 0 {
		g.Go(func() error {
			users, err := api.ds.Listening(ctx).SearchUsers(q, limit+1)
			resp.Users = newSearchGroup(users, limit)
			return err
		})
	}
	if slices.Contains(types, "listens") && byName && offset == 0 {
		g.Go(func() error {
			matches, err := api.ds.Listening(ctx).SearchListens(q, limit+1)
			listens := make([]listenResult, len(matches))
			for i, m := range matches {
				listens[i] = listenResult{activityEntry: toActivityEntry(m.ListenEntry), Plays: m.Plays}
			}
			resp.Listens = newSearchGroup(listens, limit)
			return err
		})
	}
	if err := g.Wait(); err != nil {
		log.Error(ctx, "Error searching", "q", q, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, resp)
}
