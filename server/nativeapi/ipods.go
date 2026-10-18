package nativeapi

import (
	"cmp"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/utils/req"
)

const (
	ipodCacheTTL        = 10 * time.Minute
	ipodTopSongs        = 10
	ipodTopArtists      = 10
	ipodGemsCount       = 8
	ipodMinEdgeWeight   = 0.02
	ipodMaxEdgesPerNode = 5
	ipodSharedArtistMax = 5
	ipodMaxMatches      = 20
)

type ipodTotals struct {
	model.IpodTotals
	Ipods int     `json:"ipods"`
	Songs int     `json:"songs"`
	Hours float64 `json:"hours"`
}

type ipodSharedArtist struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IpodCount int    `json:"ipodCount"`
	SongCount int    `json:"songCount"`
}

type ipodFacts struct {
	Totals            ipodTotals         `json:"totals"`
	TopDuplicateSongs []model.IpodSong   `json:"topDuplicateSongs"`
	TopSharedArtists  []ipodSharedArtist `json:"topSharedArtists"`
	Superlatives      []model.IpodStats  `json:"superlatives"`
	UniqueGems        []model.IpodGem    `json:"uniqueGems"`
}

type ipodNode struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`
	SongCount   int    `json:"songCount"`
	ArtistCount int    `json:"artistCount"`
}

type ipodEdge struct {
	Source        int      `json:"source"`
	Target        int      `json:"target"`
	Weight        float64  `json:"weight"`
	SharedCount   int      `json:"sharedCount"`
	SharedArtists []string `json:"sharedArtists"`
}

type ipodNetwork struct {
	Nodes []ipodNode `json:"nodes"`
	Edges []ipodEdge `json:"edges"`
}

type ipodMatchedArtist struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SongCount int    `json:"songCount"`
}

type ipodMatch struct {
	ID        int                 `json:"id"`
	Name      string              `json:"name"`
	SongCount int                 `json:"songCount"`
	Score     float64             `json:"score"`
	Resonance int                 `json:"resonance"`
	Matched   []ipodMatchedArtist `json:"matched"`
}

type ipodMatchResult struct {
	Matches  []ipodMatch `json:"matches"`
	NotFound []string    `json:"notFound"`
}

// ipodData is everything the iPod endpoints need, computed once per user and cached
type ipodData struct {
	createdAt time.Time
	stats     []model.IpodStats
	counts    []model.IpodArtistCount
	totals    *model.IpodTotals
	topSongs  []model.IpodSong
}

type ipodCache struct {
	mu      sync.Mutex
	entries map[string]*ipodData
}

var ipodDataCache = &ipodCache{entries: map[string]*ipodData{}}

func (api *Router) addIpodRoutes(r chi.Router) {
	r.Route("/ipods", func(r chi.Router) {
		r.Get("/facts", api.getIpodFacts)
		r.Get("/network", api.getIpodNetwork)
		r.Get("/match", api.getIpodMatch)
	})
}

// loadIpodData returns the cached data for the current user (results depend on the
// libraries the user can access), loading it from the DB if missing or expired
func (api *Router) loadIpodData(ctx context.Context) (*ipodData, error) {
	user, _ := request.UserFrom(ctx)
	ipodDataCache.mu.Lock()
	defer ipodDataCache.mu.Unlock()
	if d, ok := ipodDataCache.entries[user.ID]; ok && time.Since(d.createdAt) < ipodCacheTTL {
		return d, nil
	}

	repo := api.ds.Ipod(ctx)
	d := &ipodData{createdAt: time.Now()}
	var err error
	if d.stats, err = repo.Stats(); err != nil {
		return nil, err
	}
	if d.counts, err = repo.ArtistCounts(); err != nil {
		return nil, err
	}
	if d.totals, err = repo.Totals(); err != nil {
		return nil, err
	}
	if d.topSongs, err = repo.TopDuplicateSongs(ipodTopSongs); err != nil {
		return nil, err
	}
	ipodDataCache.entries[user.ID] = d
	return d, nil
}

func (api *Router) getIpodFacts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	d, err := api.loadIpodData(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod data", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	// Gems are not cached, so each request shows a new random sample
	gems, err := api.ds.Ipod(ctx).UniqueGems(ipodGemsCount)
	if err != nil {
		log.Error(ctx, "Error loading unique iPod songs", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	totals := ipodTotals{IpodTotals: *d.totals, Ipods: len(d.stats)}
	for _, s := range d.stats {
		totals.Songs += s.SongCount
		totals.Hours += s.TotalDuration / 3600
	}
	writeJSON(ctx, w, ipodFacts{
		Totals:            totals,
		TopDuplicateSongs: d.topSongs,
		TopSharedArtists:  topSharedArtists(d.counts, ipodTopArtists),
		Superlatives:      d.stats,
		UniqueGems:        gems,
	})
}

func (api *Router) getIpodNetwork(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	d, err := api.loadIpodData(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod data", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, buildIpodNetwork(d.stats, d.counts))
}

func (api *Router) getIpodMatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	artistIDs, _ := req.Params(r).Strings("artistId")
	d, err := api.loadIpodData(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod data", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, matchIpods(d.stats, d.counts, artistIDs))
}

func writeJSON(ctx context.Context, w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Error(ctx, "Error encoding response", err)
	}
}

func topSharedArtists(counts []model.IpodArtistCount, limit int) []ipodSharedArtist {
	byArtist := map[string]*ipodSharedArtist{}
	for _, c := range counts {
		a, ok := byArtist[c.ArtistID]
		if !ok {
			a = &ipodSharedArtist{ID: c.ArtistID, Name: c.ArtistName}
			byArtist[c.ArtistID] = a
		}
		a.IpodCount++
		a.SongCount += c.SongCount
	}
	result := make([]ipodSharedArtist, 0, len(byArtist))
	for _, a := range byArtist {
		if a.IpodCount > 1 {
			result = append(result, *a)
		}
	}
	slices.SortFunc(result, func(a, b ipodSharedArtist) int {
		return cmp.Or(
			cmp.Compare(b.IpodCount, a.IpodCount),
			cmp.Compare(b.SongCount, a.SongCount),
			cmp.Compare(a.Name, b.Name),
		)
	})
	return result[:min(limit, len(result))]
}

// artistsByIpod maps each library ID to its artists and their song counts on that iPod
func artistsByIpod(counts []model.IpodArtistCount) (map[int]map[string]int, map[string]string) {
	sets := map[int]map[string]int{}
	names := map[string]string{}
	for _, c := range counts {
		if sets[c.LibraryID] == nil {
			sets[c.LibraryID] = map[string]int{}
		}
		sets[c.LibraryID][c.ArtistID] = c.SongCount
		names[c.ArtistID] = c.ArtistName
	}
	return sets, names
}

// buildIpodNetwork links iPods by the Jaccard similarity of their artist sets. To keep the
// graph readable, an edge is only kept if it is among the strongest edges of one of its nodes
func buildIpodNetwork(stats []model.IpodStats, counts []model.IpodArtistCount) ipodNetwork {
	sets, names := artistsByIpod(counts)
	network := ipodNetwork{Nodes: make([]ipodNode, len(stats)), Edges: []ipodEdge{}}
	for i, s := range stats {
		network.Nodes[i] = ipodNode{ID: s.LibraryID, Name: s.Name, SongCount: s.SongCount, ArtistCount: len(sets[s.LibraryID])}
	}

	var candidates []ipodEdge
	for i := range stats {
		for j := i + 1; j < len(stats); j++ {
			a, b := sets[stats[i].LibraryID], sets[stats[j].LibraryID]
			var shared []string
			for id := range a {
				if _, ok := b[id]; ok {
					shared = append(shared, id)
				}
			}
			union := len(a) + len(b) - len(shared)
			if len(shared) == 0 || union == 0 {
				continue
			}
			weight := float64(len(shared)) / float64(union)
			if weight < ipodMinEdgeWeight {
				continue
			}
			// Show the artists both iPods have the most songs by
			slices.SortFunc(shared, func(x, y string) int {
				return cmp.Or(cmp.Compare(min(a[y], b[y]), min(a[x], b[x])), cmp.Compare(names[x], names[y]))
			})
			top := make([]string, 0, ipodSharedArtistMax)
			for _, id := range shared[:min(ipodSharedArtistMax, len(shared))] {
				top = append(top, names[id])
			}
			candidates = append(candidates, ipodEdge{
				Source: stats[i].LibraryID, Target: stats[j].LibraryID,
				Weight: weight, SharedCount: len(shared), SharedArtists: top,
			})
		}
	}

	slices.SortFunc(candidates, func(x, y ipodEdge) int { return cmp.Compare(y.Weight, x.Weight) })
	degree := map[int]int{}
	for _, e := range candidates {
		if degree[e.Source] >= ipodMaxEdgesPerNode && degree[e.Target] >= ipodMaxEdgesPerNode {
			continue
		}
		degree[e.Source]++
		degree[e.Target]++
		network.Edges = append(network.Edges, e)
	}
	return network
}

// matchIpods ranks iPods by how well they match a list of artists. Each matched artist
// contributes its rarity across iPods (idf) times how many of its songs the iPod has, so
// sharing a niche artist counts more than sharing one that is on every iPod.
// Resonance is the share of the (idf-weighted) input artists the iPod has.
func matchIpods(stats []model.IpodStats, counts []model.IpodArtistCount, artistIDs []string) ipodMatchResult {
	sets, names := artistsByIpod(counts)
	result := ipodMatchResult{Matches: []ipodMatch{}, NotFound: []string{}}

	idf := map[string]float64{}
	var totalIdf float64
	for _, id := range slices.Compact(slices.Sorted(slices.Values(artistIDs))) {
		df := 0
		for _, set := range sets {
			if _, ok := set[id]; ok {
				df++
			}
		}
		if df == 0 {
			result.NotFound = append(result.NotFound, id)
			continue
		}
		idf[id] = math.Log(1 + float64(len(sets))/float64(df))
		totalIdf += idf[id]
	}

	for _, s := range stats {
		m := ipodMatch{ID: s.LibraryID, Name: s.Name, SongCount: s.SongCount}
		var matchedIdf float64
		for id, w := range idf {
			songs, ok := sets[s.LibraryID][id]
			if !ok {
				continue
			}
			m.Score += w * math.Log(1+float64(songs))
			matchedIdf += w
			m.Matched = append(m.Matched, ipodMatchedArtist{ID: id, Name: names[id], SongCount: songs})
		}
		if len(m.Matched) == 0 {
			continue
		}
		m.Resonance = int(math.Round(100 * matchedIdf / totalIdf))
		slices.SortFunc(m.Matched, func(x, y ipodMatchedArtist) int {
			return cmp.Or(cmp.Compare(y.SongCount, x.SongCount), cmp.Compare(x.Name, y.Name))
		})
		result.Matches = append(result.Matches, m)
	}

	slices.SortFunc(result.Matches, func(x, y ipodMatch) int {
		return cmp.Or(cmp.Compare(y.Score, x.Score), cmp.Compare(x.Name, y.Name))
	})
	result.Matches = result.Matches[:min(ipodMaxMatches, len(result.Matches))]
	return result
}
