package nativeapi

import (
	"cmp"
	"net/http"
	"slices"
	"time"

	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
)

// Listening match: shown after logging in, it compares what the user played lately with what each
// listener sharing their activity played (as a Venn diagram of their artists), and recommends
// something the closest listener has been playing that the user hasn't: "Josh has been listening
// to X, I think you'd enjoy it"

const (
	matchWindow     = 30 * 24 * time.Hour // "Lately": the plays compared
	matchNamedLimit = 5                   // Artists named in each part of the Venn diagram
	matchSongs      = 3                   // Songs offered with the recommended artist
)

type matchListener struct {
	ID       string `json:"id"`
	UserName string `json:"username"`
	Name     string `json:"name"`
}

type matchArtist struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Plays int    `json:"plays"`
}

// matchVenn are the user's and the listener's artists: the ones only the user played, the shared
// ones and the ones only the listener played, with a few of each by name
type matchVenn struct {
	Mine       int           `json:"mine"`
	Shared     int           `json:"shared"`
	Theirs     int           `json:"theirs"`
	MineOnly   []matchArtist `json:"mineOnly"`
	SharedTop  []matchArtist `json:"sharedTop"`
	TheirsOnly []matchArtist `json:"theirsOnly"`
}

type listeningMatchResponse struct {
	Listener *matchListener         `json:"listener,omitempty"`
	Venn     matchVenn              `json:"venn"`
	Artist   *matchArtist           `json:"artist,omitempty"`
	Songs    []model.ListeningCount `json:"songs"`
	Days     int                    `json:"days"`
}

// findListeningMatch picks the listener whose artists overlap the user's the most (by Jaccard
// similarity), among the ones who played an artist the user didn't. Without any overlap, the most
// active listener is picked. The recommendation is the artist they played the most of those
func findListeningMatch(rows []model.ListenerArtistPlays, me string) listeningMatchResponse {
	resp := listeningMatchResponse{Songs: []model.ListeningCount{}, Days: int(matchWindow.Hours() / 24)}
	type listener struct {
		info    matchListener
		artists map[string]model.ListenerArtistPlays
		plays   int
	}
	byUser := map[string]*listener{}
	var order []string
	for _, row := range rows {
		l, ok := byUser[row.UserID]
		if !ok {
			l = &listener{
				info:    matchListener{ID: row.UserID, UserName: row.UserName, Name: row.Name},
				artists: map[string]model.ListenerArtistPlays{},
			}
			byUser[row.UserID] = l
			order = append(order, row.UserID)
		}
		l.artists[row.ArtistID] = row
		l.plays += row.Plays
	}
	mine := map[string]model.ListenerArtistPlays{}
	if l, ok := byUser[me]; ok {
		mine = l.artists
	}

	var best *listener
	var bestScore float64
	for _, id := range order {
		l := byUser[id]
		if id == me {
			continue
		}
		shared, theirsOnly := 0, 0
		for a := range l.artists {
			if _, ok := mine[a]; ok {
				shared++
			} else {
				theirsOnly++
			}
		}
		if theirsOnly == 0 {
			continue // Nothing to recommend
		}
		score := float64(shared) / float64(len(mine)+theirsOnly)
		if best == nil || score > bestScore || (score == bestScore && l.plays > best.plays) {
			best, bestScore = l, score
		}
	}
	if best == nil {
		return resp
	}
	resp.Listener = &best.info

	var mineOnly, shared, theirsOnly []matchArtist
	for id, a := range mine {
		if t, ok := best.artists[id]; ok {
			shared = append(shared, matchArtist{ID: id, Name: a.ArtistName, Plays: a.Plays + t.Plays})
		} else {
			mineOnly = append(mineOnly, matchArtist{ID: id, Name: a.ArtistName, Plays: a.Plays})
		}
	}
	for id, a := range best.artists {
		if _, ok := mine[id]; !ok {
			theirsOnly = append(theirsOnly, matchArtist{ID: id, Name: a.ArtistName, Plays: a.Plays})
		}
	}
	for _, list := range [][]matchArtist{mineOnly, shared, theirsOnly} {
		slices.SortFunc(list, func(a, b matchArtist) int {
			return cmp.Or(cmp.Compare(b.Plays, a.Plays), cmp.Compare(a.Name, b.Name))
		})
	}
	top := func(list []matchArtist) []matchArtist {
		return slices.Clone(list[:min(len(list), matchNamedLimit)])
	}
	resp.Venn = matchVenn{
		Mine: len(mineOnly) + len(shared), Shared: len(shared), Theirs: len(theirsOnly) + len(shared),
		MineOnly: top(mineOnly), SharedTop: top(shared), TheirsOnly: top(theirsOnly),
	}
	if resp.Venn.MineOnly == nil {
		resp.Venn.MineOnly = []matchArtist{}
	}
	if resp.Venn.SharedTop == nil {
		resp.Venn.SharedTop = []matchArtist{}
	}
	resp.Artist = &theirsOnly[0]
	return resp
}

func (api *Router) getListeningMatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	me, _ := request.UserFrom(ctx)
	since := time.Now().Add(-matchWindow)
	repo := api.ds.Listening(ctx)
	rows, err := repo.ListenerArtists(since)
	if err != nil {
		log.Error(ctx, "Error loading listeners' artists", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	resp := findListeningMatch(rows, me.ID)
	if resp.Listener != nil && resp.Artist != nil {
		songs, err := repo.TopSongsOf(resp.Listener.ID, resp.Artist.ID, since, matchSongs)
		if err != nil {
			log.Error(ctx, "Error loading listener's songs", "listener", resp.Listener.UserName, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		resp.Songs = songs
	}
	writeJSON(ctx, w, resp)
}
