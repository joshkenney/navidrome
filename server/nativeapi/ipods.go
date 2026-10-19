package nativeapi

import (
	"cmp"
	"context"
	"encoding/json"
	"math"
	"math/rand/v2"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/req"
)

const (
	ipodCacheTTL        = 10 * time.Minute
	ipodTopSongs        = 10
	ipodTopArtists      = 10
	ipodGemsCount       = 8
	ipodGemPoolSize     = 300
	ipodMinEdgeWeight   = 0.02
	ipodMaxEdgesPerNode = 5
	ipodSharedArtistMax = 5
	ipodMaxMatches      = 20
)

type ipodTotals struct {
	model.IpodTotals
	Ipods         int     `json:"ipods"`
	Songs         int     `json:"songs"`
	Hours         float64 `json:"hours"`
	DistinctSongs int     `json:"distinctSongs"`
	SharedSongs   int     `json:"sharedSongs"`
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
	Twins             *ipodTwins         `json:"twins"`
}

type ipodRef struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// ipodTwins are the two iPods with the most similar artists
type ipodTwins struct {
	A             ipodRef  `json:"a"`
	B             ipodRef  `json:"b"`
	Weight        float64  `json:"weight"`
	SharedCount   int      `json:"sharedCount"`
	SharedArtists []string `json:"sharedArtists"`
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

// ipodSongSummary is what the facts need from the song index
type ipodSongSummary struct {
	topSongs      []model.IpodSong
	gemPool       []model.IpodGem
	distinctSongs int
	sharedSongs   int
}

// ipodData is everything the iPod endpoints need, computed once and cached
type ipodData struct {
	createdAt time.Time
	stats     []model.IpodStats
	counts    []model.IpodArtistCount
	totals    ipodTotals
	songs     ipodSongSummary
}

// ipodCache is keyed by DataVersion, so users who can access the same iPods share an entry,
// and entries are reloaded after a scan
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

// loadIpodData returns the cached data for the iPods the current user can access, loading
// it from the DB if missing, expired, or if the libraries changed since it was loaded
func (api *Router) loadIpodData(ctx context.Context) (*ipodData, error) {
	repo := api.ds.Ipod(ctx)
	version, err := repo.DataVersion()
	if err != nil {
		return nil, err
	}

	ipodDataCache.mu.Lock()
	defer ipodDataCache.mu.Unlock()
	if d, ok := ipodDataCache.entries[version]; ok && time.Since(d.createdAt) < ipodCacheTTL {
		return d, nil
	}

	d := &ipodData{createdAt: time.Now()}
	if d.stats, err = repo.Stats(); err != nil {
		return nil, err
	}
	if d.counts, err = repo.ArtistCounts(); err != nil {
		return nil, err
	}
	totals, err := repo.Totals()
	if err != nil {
		return nil, err
	}
	entries, err := repo.SongIndex()
	if err != nil {
		return nil, err
	}
	d.songs = summarizeSongs(entries, d.stats)

	d.totals = ipodTotals{
		IpodTotals:    *totals,
		Ipods:         len(d.stats),
		DistinctSongs: d.songs.distinctSongs,
		SharedSongs:   d.songs.sharedSongs,
	}
	for _, s := range d.stats {
		d.totals.Songs += s.SongCount
		d.totals.Hours += s.TotalDuration / 3600
	}

	for k, e := range ipodDataCache.entries {
		if time.Since(e.createdAt) >= ipodCacheTTL {
			delete(ipodDataCache.entries, k)
		}
	}
	ipodDataCache.entries[version] = d
	return d, nil
}

// summarizeSongs finds the songs on the most iPods and a random pool of songs found on only
// one iPod, and fills in the DistinctSongs and UniqueSongs of each iPod's stats
func summarizeSongs(entries []model.IpodSongEntry, stats []model.IpodStats) ipodSongSummary {
	names := make(map[int]string, len(stats))
	for _, s := range stats {
		names[s.LibraryID] = s.Name
	}
	byKey := map[string][]model.IpodSongEntry{}
	for _, e := range entries {
		byKey[e.Key] = append(byKey[e.Key], e)
	}

	var summary ipodSongSummary
	distinct := map[int]int{}
	unique := map[int]int{}
	var gems []model.IpodGem
	for _, found := range byKey {
		summary.distinctSongs++
		for _, e := range found {
			distinct[e.LibraryID]++
		}
		first := slices.MinFunc(found, func(a, b model.IpodSongEntry) int { return cmp.Compare(a.Title, b.Title) })
		if len(found) == 1 {
			unique[first.LibraryID]++
			gems = append(gems, model.IpodGem{
				MediaFileID: first.MediaFileID, Title: first.Title, Artist: first.Artist,
				LibraryID: first.LibraryID, LibraryName: names[first.LibraryID],
			})
			continue
		}
		summary.sharedSongs++
		ipodNames := make([]string, len(found))
		for i, e := range found {
			ipodNames[i] = names[e.LibraryID]
		}
		slices.Sort(ipodNames)
		summary.topSongs = append(summary.topSongs, model.IpodSong{
			MediaFileID: first.MediaFileID, Title: first.Title, Artist: first.Artist,
			IpodCount: len(found), IpodNames: ipodNames,
		})
	}

	slices.SortFunc(summary.topSongs, func(a, b model.IpodSong) int {
		return cmp.Or(cmp.Compare(b.IpodCount, a.IpodCount), cmp.Compare(a.Title, b.Title))
	})
	summary.topSongs = summary.topSongs[:min(ipodTopSongs, len(summary.topSongs))]
	if summary.topSongs == nil {
		summary.topSongs = []model.IpodSong{}
	}

	rand.Shuffle(len(gems), func(i, j int) { gems[i], gems[j] = gems[j], gems[i] })
	summary.gemPool = gems[:min(ipodGemPoolSize, len(gems))]

	for i := range stats {
		stats[i].DistinctSongs = distinct[stats[i].LibraryID]
		stats[i].UniqueSongs = unique[stats[i].LibraryID]
	}
	return summary
}

// sampleGems picks a few random songs from the pool, without changing it
func sampleGems(pool []model.IpodGem, n int) []model.IpodGem {
	idx := rand.Perm(len(pool))[:min(n, len(pool))]
	gems := make([]model.IpodGem, len(idx))
	for i, j := range idx {
		gems[i] = pool[j]
	}
	return gems
}

func (api *Router) getIpodFacts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	d, err := api.loadIpodData(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod data", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, ipodFacts{
		Totals:            d.totals,
		TopDuplicateSongs: d.songs.topSongs,
		TopSharedArtists:  topSharedArtists(d.counts, ipodTopArtists),
		Superlatives:      d.stats,
		UniqueGems:        sampleGems(d.songs.gemPool, ipodGemsCount),
		Twins:             findIpodTwins(d.stats, d.counts),
	})
}

// findIpodTwins returns the two iPods linked by the strongest edge of the network, if any
func findIpodTwins(stats []model.IpodStats, counts []model.IpodArtistCount) *ipodTwins {
	edges := buildIpodNetwork(stats, counts).Edges
	if len(edges) == 0 {
		return nil
	}
	names := make(map[int]string, len(stats))
	for _, s := range stats {
		names[s.LibraryID] = s.Name
	}
	e := edges[0]
	return &ipodTwins{
		A:             ipodRef{ID: e.Source, Name: names[e.Source]},
		B:             ipodRef{ID: e.Target, Name: names[e.Target]},
		Weight:        e.Weight,
		SharedCount:   e.SharedCount,
		SharedArtists: e.SharedArtists,
	}
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
	keys, err := api.ds.Ipod(ctx).ArtistKeys(artistIDs)
	if err != nil {
		log.Error(ctx, "Error loading artists", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, matchIpods(d.stats, d.counts, artistIDs, keys))
}

func writeJSON(ctx context.Context, w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Error(ctx, "Error encoding response", err)
	}
}

func topSharedArtists(counts []model.IpodArtistCount, limit int) []ipodSharedArtist {
	_, artists := artistsByIpod(counts)
	byArtist := map[string]*ipodSharedArtist{}
	for _, c := range counts {
		a, ok := byArtist[c.Key]
		if !ok {
			a = &ipodSharedArtist{ID: artists[c.Key].ID, Name: artists[c.Key].Name}
			byArtist[c.Key] = a
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

// ipodArtistRef is the artist shown for an artist Key: the spelling with the most songs
type ipodArtistRef struct {
	ID    string
	Name  string
	songs int
}

// artistsByIpod maps each library ID to its artists (by Key) and their song counts on that
// iPod. It also returns the artist to show for each Key
func artistsByIpod(counts []model.IpodArtistCount) (map[int]map[string]int, map[string]ipodArtistRef) {
	sets := map[int]map[string]int{}
	songsByID := map[string]int{}
	for _, c := range counts {
		if sets[c.LibraryID] == nil {
			sets[c.LibraryID] = map[string]int{}
		}
		sets[c.LibraryID][c.Key] = c.SongCount
		songsByID[c.ArtistID] += c.SongCount
	}
	artists := map[string]ipodArtistRef{}
	for _, c := range counts {
		ref := ipodArtistRef{ID: c.ArtistID, Name: c.ArtistName, songs: songsByID[c.ArtistID]}
		cur, ok := artists[c.Key]
		if !ok || ref.songs > cur.songs || (ref.songs == cur.songs && ref.Name < cur.Name) {
			artists[c.Key] = ref
		}
	}
	return sets, artists
}

// buildIpodNetwork links iPods by the Jaccard similarity of their artist sets. To keep the
// graph readable, an edge is only kept if it is among the strongest edges of one of its nodes
func buildIpodNetwork(stats []model.IpodStats, counts []model.IpodArtistCount) ipodNetwork {
	sets, artists := artistsByIpod(counts)
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
				return cmp.Or(cmp.Compare(min(a[y], b[y]), min(a[x], b[x])), cmp.Compare(artists[x].Name, artists[y].Name))
			})
			top := make([]string, 0, ipodSharedArtistMax)
			for _, id := range shared[:min(ipodSharedArtistMax, len(shared))] {
				top = append(top, artists[id].Name)
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
// Artists are matched by Key (artistKeys maps each input artist ID to its Key), so picking
// "The Spill Canvas" also matches iPods that have "Spill Canvas"
func matchIpods(stats []model.IpodStats, counts []model.IpodArtistCount, artistIDs []string, artistKeys map[string]string) ipodMatchResult {
	sets, artists := artistsByIpod(counts)
	result := ipodMatchResult{Matches: []ipodMatch{}, NotFound: []string{}}

	idf := map[string]float64{}
	var totalIdf float64
	for _, id := range slices.Compact(slices.Sorted(slices.Values(artistIDs))) {
		key, ok := artistKeys[id]
		if _, seen := idf[key]; ok && seen {
			continue
		}
		df := 0
		for _, set := range sets {
			if _, has := set[key]; ok && has {
				df++
			}
		}
		if df == 0 {
			result.NotFound = append(result.NotFound, id)
			continue
		}
		idf[key] = math.Log(1 + float64(len(sets))/float64(df))
		totalIdf += idf[key]
	}

	for _, s := range stats {
		m := ipodMatch{ID: s.LibraryID, Name: s.Name, SongCount: s.SongCount}
		var matchedIdf float64
		for key, w := range idf {
			songs, ok := sets[s.LibraryID][key]
			if !ok {
				continue
			}
			m.Score += w * math.Log(1+float64(songs))
			matchedIdf += w
			m.Matched = append(m.Matched, ipodMatchedArtist{ID: artists[key].ID, Name: artists[key].Name, SongCount: songs})
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
