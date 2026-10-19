package nativeapi

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/utils/req"
	"github.com/navidrome/navidrome/utils/songkey"
)

const (
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
	Tribes            []ipodTribe        `json:"tribes"`
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
	ID          int      `json:"id"`
	Name        string   `json:"name"`
	SongCount   int      `json:"songCount"`
	ArtistCount int      `json:"artistCount"`
	Taste       int      `json:"taste"`
	TasteLabel  string   `json:"tasteLabel"`
	DeepCuts    []string `json:"deepCuts"`
	Anthems     []string `json:"anthems"`
	Tribe       int      `json:"tribe"`
}

type ipodEdge struct {
	Source        int      `json:"source"`
	Target        int      `json:"target"`
	Weight        float64  `json:"weight"`
	SharedCount   int      `json:"sharedCount"`
	SharedArtists []string `json:"sharedArtists"`
}

type ipodNetwork struct {
	Nodes  []ipodNode  `json:"nodes"`
	Edges  []ipodEdge  `json:"edges"`
	Tribes []ipodTribe `json:"tribes"`
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
	Taste     int                 `json:"taste"`
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
	version   string
	stats     []model.IpodStats
	counts    []model.IpodArtistCount
	totals    ipodTotals
	songs     ipodSongSummary
	network   ipodNetwork
	taste     tasteModel
	tribes    ipodTribes
	radio     *radioIndex
}

// ipodCache holds the data of each set of iPods users can access (users with the same access
// share an entry). Computing it reads every song, which takes a while on large servers, so once an
// entry has data it is always served right away: when it is outdated (the iPods changed), it is
// recomputed in the background (see ipodMinRefreshInterval). Only the very first load waits, and
// concurrent requests wait for that same load
type ipodCache struct {
	mu      sync.Mutex
	entries map[string]*ipodCacheEntry
}

type ipodCacheEntry struct {
	data       *ipodData
	err        error
	loading    chan struct{} // Closed when the first load is done
	refreshing bool
}

var ipodDataCache = &ipodCache{entries: map[string]*ipodCacheEntry{}}

// Computing the data is heavy (it reads every song), so it is redone at most this often, never
// during a scan (when the data keeps changing), and one computation at a time
var (
	ipodMinRefreshInterval = 15 * time.Minute
	ipodComputeMu          sync.Mutex
)

// ipodAccessKey is the part of a DataVersion identifying the iPods a user can access
func ipodAccessKey(version string) string {
	if i := strings.Index(version, "|"); i >= 0 {
		return version[:i]
	}
	return version
}

func (api *Router) addIpodRoutes(r chi.Router) {
	r.Route("/ipods", func(r chi.Router) {
		r.Get("/facts", api.getIpodFacts)
		r.Get("/network", api.getIpodNetwork)
		r.Get("/match", api.getIpodMatch)
		r.Get("/radio", api.getIpodRadio)
		r.Get("/radio/history", api.getRadioHistory)
		r.Post("/radio/history", api.addRadioHistory)
		r.Delete("/radio/history", api.deleteRadioHistory)
		r.Get("/taste/me", api.getMyTaste)
		r.With(adminOnlyMiddleware).Put("/tribes/name", api.renameIpodTribe)
	})
}

// loadIpodData returns the data for the iPods the current user can access. See ipodCache
func (api *Router) loadIpodData(ctx context.Context) (*ipodData, error) {
	version, err := api.ds.Ipod(ctx).DataVersion()
	if err != nil {
		return nil, err
	}
	access := ipodAccessKey(version)
	c := ipodDataCache

	c.mu.Lock()
	e, ok := c.entries[access]
	switch {
	case ok && e.data != nil:
		outdated := e.data.version != version && time.Since(e.data.createdAt) >= ipodMinRefreshInterval
		if outdated && !e.refreshing {
			e.refreshing = true
			go api.refreshIpodData(context.WithoutCancel(ctx), access, e)
		}
		d := e.data
		c.mu.Unlock()
		return d, nil
	case ok:
		// The first load is running: wait for it
		loading := e.loading
		c.mu.Unlock()
		<-loading
		c.mu.Lock()
		defer c.mu.Unlock()
		return e.data, e.err
	}
	e = &ipodCacheEntry{loading: make(chan struct{})}
	c.entries[access] = e
	c.mu.Unlock()

	d, err := api.computeIpodData(ctx)

	c.mu.Lock()
	defer c.mu.Unlock()
	e.data, e.err = d, err
	close(e.loading)
	if err != nil {
		delete(c.entries, access) // Try again on the next request
	}
	return d, err
}

// WarmIpodData computes the iPod data for the all-iPods view (admins), so iPod requests don't wait
// for it. It runs with no user in the context, which sees every iPod. When the data is cached, it
// returns at once, refreshing outdated data in the background (see loadIpodData)
func (api *Router) WarmIpodData(ctx context.Context) {
	start := time.Now()
	if _, err := api.loadIpodData(ctx); err != nil {
		log.Error(ctx, "Error preparing iPod data", err)
		return
	}
	if elapsed := time.Since(start); elapsed >= time.Second {
		log.Info(ctx, "iPod data ready", "elapsed", elapsed)
	}
}

// refreshIpodData recomputes outdated data in the background, while the old data is still served
func (api *Router) refreshIpodData(ctx context.Context, access string, e *ipodCacheEntry) {
	var d *ipodData
	scanning, err := api.ds.Library(ctx).ScanInProgress()
	if err == nil && !scanning {
		d, err = api.computeIpodData(ctx)
	}
	c := ipodDataCache
	c.mu.Lock()
	defer c.mu.Unlock()
	e.refreshing = false
	if err != nil {
		log.Error(ctx, "Error refreshing iPod data", err)
		return
	}
	if d != nil {
		e.data = d
	}
}

// computeIpodData reads the iPods' songs and artists, and computes everything the iPod features show
func (api *Router) computeIpodData(ctx context.Context) (*ipodData, error) {
	ipodComputeMu.Lock()
	defer ipodComputeMu.Unlock()
	start := time.Now()
	repo := api.ds.Ipod(ctx)
	version, err := repo.DataVersion()
	if err != nil {
		return nil, err
	}
	d := &ipodData{createdAt: time.Now(), version: version}
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
	d.taste = computeTasteScores(d.stats, d.counts)
	for i := range d.stats {
		d.stats[i].Taste = d.taste.byIpod[d.stats[i].LibraryID].Score
	}
	genres, err := repo.GenreCounts()
	if err != nil {
		return nil, err
	}
	pairs := ipodSimilarities(d.stats, d.counts)
	d.network = networkFromPairs(d.stats, d.counts, pairs)
	d.tribes = findTribes(d.stats, d.counts, genres, pairs, d.taste, api.tribeOverrides(ctx))
	d.network.Tribes = d.tribes.tribes
	for i, n := range d.network.Nodes {
		t := d.taste.byIpod[n.ID]
		d.network.Nodes[i].Taste, d.network.Nodes[i].TasteLabel = t.Score, t.Label
		d.network.Nodes[i].DeepCuts, d.network.Nodes[i].Anthems = t.DeepCuts, t.Anthems
		d.network.Nodes[i].Tribe = d.tribes.byIpod[n.ID]
	}
	d.radio = buildRadioIndex(entries, d.stats, d.counts, d.network.Edges)

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

	log.Info(ctx, "Loaded iPod data", "ipods", len(d.stats), "songs", d.totals.Songs,
		"tribes", len(d.tribes.tribes), "elapsed", time.Since(start))
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
		Twins:             twinsFromEdges(d.stats, d.network.Edges),
		Tribes:            d.tribes.tribes,
	})
}

// findIpodTwins returns the two iPods linked by the strongest edge of the network, if any
func findIpodTwins(stats []model.IpodStats, counts []model.IpodArtistCount) *ipodTwins {
	return twinsFromEdges(stats, buildIpodNetwork(stats, counts).Edges)
}

func twinsFromEdges(stats []model.IpodStats, edges []ipodEdge) *ipodTwins {
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
	writeJSON(ctx, w, d.network)
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
	result := matchIpods(d.stats, d.counts, artistIDs, keys)
	for i, m := range result.Matches {
		result.Matches[i].Taste = d.taste.byIpod[m.ID].Score
	}
	writeJSON(ctx, w, result)
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
	return networkFromPairs(stats, counts, ipodSimilarities(stats, counts))
}

// ipodPair is the Jaccard similarity of the artists of two iPods (indexes in stats)
type ipodPair struct {
	i, j   int
	shared int
	weight float64
}

// ipodSimilarities returns the pairs of iPods that share enough artists, most similar first
func ipodSimilarities(stats []model.IpodStats, counts []model.IpodArtistCount) []ipodPair {
	sets, _ := artistsByIpod(counts)

	// Artist sets as sorted lists of numbers, so comparing two iPods is a fast merge
	artistIDs := map[string]int32{}
	lists := make([][]int32, len(stats))
	for i, s := range stats {
		for key := range sets[s.LibraryID] {
			id, ok := artistIDs[key]
			if !ok {
				id = int32(len(artistIDs))
				artistIDs[key] = id
			}
			lists[i] = append(lists[i], id)
		}
		slices.Sort(lists[i])
	}

	var pairs []ipodPair
	for i := range stats {
		for j := i + 1; j < len(stats); j++ {
			shared := overlap(lists[i], lists[j])
			union := len(lists[i]) + len(lists[j]) - shared
			if shared == 0 || union == 0 {
				continue
			}
			if weight := float64(shared) / float64(union); weight >= ipodMinEdgeWeight {
				pairs = append(pairs, ipodPair{i: i, j: j, shared: shared, weight: weight})
			}
		}
	}
	slices.SortFunc(pairs, func(x, y ipodPair) int {
		return cmp.Or(cmp.Compare(y.weight, x.weight), cmp.Compare(x.i, y.i), cmp.Compare(x.j, y.j))
	})
	return pairs
}

// networkFromPairs keeps, for readability, only edges among the strongest of one of their nodes
func networkFromPairs(stats []model.IpodStats, counts []model.IpodArtistCount, pairs []ipodPair) ipodNetwork {
	sets, artists := artistsByIpod(counts)
	network := ipodNetwork{Nodes: make([]ipodNode, len(stats)), Edges: []ipodEdge{}, Tribes: []ipodTribe{}}
	for i, s := range stats {
		network.Nodes[i] = ipodNode{ID: s.LibraryID, Name: s.Name, SongCount: s.SongCount, ArtistCount: len(sets[s.LibraryID]), Tribe: -1}
	}
	degree := map[int]int{}
	for _, p := range pairs {
		if degree[p.i] >= ipodMaxEdgesPerNode && degree[p.j] >= ipodMaxEdgesPerNode {
			continue
		}
		degree[p.i]++
		degree[p.j]++
		network.Edges = append(network.Edges, ipodEdge{
			Source: stats[p.i].LibraryID, Target: stats[p.j].LibraryID,
			Weight: p.weight, SharedCount: p.shared,
			SharedArtists: topSharedNames(sets[stats[p.i].LibraryID], sets[stats[p.j].LibraryID], artists),
		})
	}
	return network
}

// topSharedNames returns the artists both iPods have the most songs by
func topSharedNames(a, b map[string]int, artists map[string]ipodArtistRef) []string {
	var shared []string
	for key := range a {
		if _, ok := b[key]; ok {
			shared = append(shared, key)
		}
	}
	slices.SortFunc(shared, func(x, y string) int {
		return cmp.Or(cmp.Compare(min(a[y], b[y]), min(a[x], b[x])), cmp.Compare(artists[x].Name, artists[y].Name))
	})
	top := make([]string, 0, ipodSharedArtistMax)
	for _, key := range shared[:min(ipodSharedArtistMax, len(shared))] {
		top = append(top, artists[key].Name)
	}
	return top
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

const (
	radioMaxExclude     = 500
	radioMaxDrift       = 3
	radioMaxReactions   = 20
	radioAnchorWeight   = 0.5
	radioLikeBias       = 1.3
	radioMaxLikeBias    = 1.6
	radioSkipBias       = 0.3
	radioRepeatSkipBias = 0.15
)

// Weights of the drift seeds, from the most recently played
var radioDriftWeights = []float64{1.0, 0.7, 0.5}

type ipodRadioResponse struct {
	Seed *model.MediaFile `json:"seed"`
	// RadioSeedID is the song the radio is based on: the seed, or a stand-in when the seed is
	// not found on any iPod (SeedFallback). It is the songId to ask for more songs
	RadioSeedID  string                 `json:"radioSeedId"`
	SeedFallback bool                   `json:"seedFallback"`
	Songs        model.MediaFiles       `json:"songs"`
	Reasons      map[string]radioReason `json:"reasons"`
}

// getIpodRadio returns songs to play after a seed song (songId), or after a random seed when no
// songId is given. adventure (-1 to 1) favors crowd-pleasers or deep cuts, and exclude lists the
// songs already queued
func (api *Router) getIpodRadio(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p := req.Params(r)
	songID, _ := p.String("songId")
	count := min(p.IntOr("count", radioDefaultCount), radioMaxCount)
	adventure, err := strconv.ParseFloat(p.StringOr("adventure", "0"), 64)
	if err != nil || math.IsNaN(adventure) {
		adventure = 0
	}
	adventure = max(-1, min(1, adventure))
	exclude, _ := p.Strings("exclude")
	exclude = exclude[max(0, len(exclude)-radioMaxExclude):]
	drift, _ := p.Strings("drift")
	drift = drift[:min(radioMaxDrift, len(drift))]
	liked, _ := p.Strings("liked")
	liked = liked[max(0, len(liked)-radioMaxReactions):]
	skipped, _ := p.Strings("skipped")
	skipped = skipped[max(0, len(skipped)-radioMaxReactions):]

	timer := newStepTimer()
	d, err := api.loadIpodData(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod data", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	timer.step("data")
	idx := d.radio
	rng := rand.New(rand.NewPCG(rand.Uint64(), rand.Uint64()))
	mfRepo := api.ds.MediaFile(ctx)

	seed, seedArtist := int32(-1), int32(-1)
	var seedFile *model.MediaFile
	if songID != "" {
		seedFile, err = mfRepo.Get(songID)
		if errors.Is(err, model.ErrNotFound) {
			http.Error(w, "song not found", http.StatusNotFound)
			return
		}
		if err != nil {
			log.Error(ctx, "Error loading radio seed", "id", songID, err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		seed, seedArtist = api.radioSeed(ctx, idx, seedFile)
	} else if seed = idx.surpriseSeed(adventure, rng); seed >= 0 {
		seedFile, err = mfRepo.Get(idx.songs[seed].rep)
		if err != nil {
			log.Error(ctx, "Error loading radio seed", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	}
	// Neither the song nor its artist is on any iPod: still play something, based on a stand-in
	fallback := false
	if seed < 0 && seedArtist < 0 {
		if seed = idx.surpriseSeed(adventure, rng); seed < 0 {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		fallback = true
		log.Debug(ctx, "iPod Radio: seed not found on any iPod, using a stand-in", "id", songID,
			"standIn", idx.songs[seed].rep)
	}
	timer.step("seed")
	radioSeedID := songID
	if seed >= 0 && (songID == "" || fallback) {
		radioSeedID = idx.songs[seed].rep
	}

	// Songs already queued, and the listener's reactions, all resolved with a single query
	songOf := map[string]int32{}
	if ids := slices.Concat(exclude, drift, liked, skipped); len(ids) > 0 {
		files, err := mfRepo.GetAll(model.QueryOptions{Filters: squirrel.Eq{"media_file.id": slices.Compact(slices.Sorted(slices.Values(ids)))}})
		if err != nil {
			log.Error(ctx, "Error loading radio session songs", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		for _, mf := range files {
			if s := idx.songOf(songkey.Key(mf.Title, mf.ArtistID, mf.OrderArtistName)); s >= 0 {
				songOf[mf.ID] = s
			}
		}
	}
	excluded := map[int32]bool{}
	for _, id := range exclude {
		if s, ok := songOf[id]; ok {
			excluded[s] = true
		}
	}
	bias := radioBias(idx, resolveSongs(songOf, liked), resolveSongs(songOf, skipped))
	seeds := radioSeeds(idx, seed, seedArtist, resolveSongs(songOf, drift), bias)

	picks := idx.recommendFrom(seeds, radioOptions{count: count, adventure: adventure, exclude: excluded, bias: bias, rng: rng})
	timer.step("picks")
	ids := make([]string, len(picks))
	reasons := make(map[string]radioReason, len(picks))
	for i, pick := range picks {
		ids[i] = idx.songs[pick.song].rep
		reasons[ids[i]] = pick.reason
	}
	files, err := mfRepo.GetAll(model.QueryOptions{Filters: squirrel.Eq{"media_file.id": ids}})
	if err != nil {
		log.Error(ctx, "Error loading radio songs", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	// Keep the order of the picks
	byID := make(map[string]model.MediaFile, len(files))
	for _, f := range files {
		byID[f.ID] = f
	}
	songs := make(model.MediaFiles, 0, len(ids))
	for _, id := range ids {
		if f, ok := byID[id]; ok {
			songs = append(songs, f)
		}
	}
	timer.step("songs")
	timer.report(ctx, w, "iPod Radio: slow start")
	writeJSON(ctx, w, ipodRadioResponse{
		Seed: seedFile, RadioSeedID: radioSeedID, SeedFallback: fallback, Songs: songs, Reasons: reasons,
	})
}

// slowRequest is how long a request can take before its steps are logged
const slowRequest = time.Second

// stepTimer times the steps of a request, to show where the time goes: in the Server-Timing header
// (the browser's Network tab), and in the log when the request is slow
type stepTimer struct {
	start, last time.Time
	names       []string
	durations   []time.Duration
}

func newStepTimer() *stepTimer {
	now := time.Now()
	return &stepTimer{start: now, last: now}
}

func (t *stepTimer) step(name string) {
	now := time.Now()
	t.names = append(t.names, name)
	t.durations = append(t.durations, now.Sub(t.last))
	t.last = now
}

func (t *stepTimer) report(ctx context.Context, w http.ResponseWriter, slowMsg string) {
	timings := make([]string, len(t.names))
	logArgs := []any{"elapsed", time.Since(t.start)}
	for i, name := range t.names {
		timings[i] = fmt.Sprintf("%s;dur=%.1f", name, float64(t.durations[i].Microseconds())/1000)
		logArgs = append(logArgs, name, t.durations[i])
	}
	w.Header().Set("Server-Timing", strings.Join(timings, ", "))
	if time.Since(t.start) >= slowRequest {
		log.Info(append([]any{ctx, slowMsg}, logArgs...)...)
	}
}

func resolveSongs(songOf map[string]int32, ids []string) []int32 {
	var songs []int32
	for _, id := range ids {
		if s, ok := songOf[id]; ok {
			songs = append(songs, s)
		}
	}
	return songs
}

// radioBias turns the listener's reactions into artist score multipliers: skipped artists are
// played much less, artists played through a bit more
func radioBias(idx *radioIndex, liked, skipped []int32) map[int32]float64 {
	likes, skips := map[int32]int{}, map[int32]int{}
	for _, s := range liked {
		likes[idx.songs[s].artist]++
	}
	for _, s := range skipped {
		skips[idx.songs[s].artist]++
	}
	bias := map[int32]float64{}
	for a, n := range likes {
		bias[a] = min(radioMaxLikeBias, math.Pow(radioLikeBias, float64(n)))
	}
	for a, n := range skips {
		f := radioSkipBias
		if n > 1 {
			f = radioRepeatSkipBias
		}
		bias[a] = max(bias[a], 1) * f
	}
	return bias
}

// radioSeeds anchors the radio on its starting song, and lets it drift towards the songs the
// listener played through recently (most recent first), skipping artists they skip
func radioSeeds(idx *radioIndex, anchor, anchorArtist int32, drift []int32, bias map[int32]float64) []radioSeed {
	var drifted []radioSeed
	for _, s := range drift {
		if len(drifted) == len(radioDriftWeights) {
			break
		}
		if b, skipped := bias[idx.songs[s].artist]; s == anchor || skipped && b < 1 {
			continue
		}
		drifted = append(drifted, radioSeed{song: s, artist: -1, weight: radioDriftWeights[len(drifted)]})
	}
	anchorWeight := 1.0
	if len(drifted) > 0 {
		anchorWeight = radioAnchorWeight
	}
	return append([]radioSeed{{song: anchor, artist: anchorArtist, weight: anchorWeight}}, drifted...)
}

// radioSeed finds the seed song in the radio index or, failing that (placeholder titles, songs
// only found outside the iPods), the seed's artist
func (api *Router) radioSeed(ctx context.Context, idx *radioIndex, mf *model.MediaFile) (int32, int32) {
	key := songkey.Key(mf.Title, mf.ArtistID, mf.OrderArtistName)
	if s := idx.songOf(key); s >= 0 {
		return s, -1
	}
	candidates := []string{songkey.ArtistKey(mf.OrderArtistName), mf.ArtistID}
	if keys, err := api.ds.Ipod(ctx).ArtistKeys([]string{mf.ArtistID, mf.AlbumArtistID}); err == nil {
		candidates = append(candidates, keys[mf.ArtistID], keys[mf.AlbumArtistID])
	}
	for _, c := range candidates {
		if a := idx.artistOf(c); c != "" && a >= 0 {
			log.Debug(ctx, "iPod Radio: seed song not on any iPod, using its artist", "id", mf.ID, "key", key, "artist", c)
			return -1, a
		}
	}
	log.Debug(ctx, "iPod Radio: seed not found", "id", mf.ID, "key", key, "artists", candidates,
		"indexedSongs", len(idx.songs), "indexedArtists", len(idx.artists))
	return -1, -1
}

// getMyTaste places the current user's listening among the iPods' tastes. Returns null until the
// user has played enough songs by artists found on the iPods
func (api *Router) getMyTaste(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	d, err := api.loadIpodData(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod data", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	plays, err := api.ds.Ipod(ctx).UserArtistPlays()
	if err != nil {
		log.Error(ctx, "Error loading plays", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	type myTaste struct {
		*ipodTaste
		Tribe *ipodTribe `json:"tribe"`
	}
	t := d.taste.userTaste(plays)
	if t == nil {
		writeJSON(ctx, w, nil)
		return
	}
	writeJSON(ctx, w, myTaste{ipodTaste: t, Tribe: d.tribes.userTribe(plays)})
}

// tribeNamesKey is the property holding the tribe names chosen by admins
const tribeNamesKey = "IpodTribeNames"

func (api *Router) tribeOverrides(ctx context.Context) []tribeOverride {
	value, err := api.ds.Property(ctx).DefaultGet(tribeNamesKey, "[]")
	if err != nil {
		log.Error(ctx, "Error loading tribe names", err)
		return nil
	}
	var overrides []tribeOverride
	if err := json.Unmarshal([]byte(value), &overrides); err != nil {
		log.Error(ctx, "Error reading tribe names", err)
		return nil
	}
	return overrides
}

// renameIpodTribe sets (or, with an empty name, removes) the name of the tribe made of the given
// iPods. Admins only
func (api *Router) renameIpodTribe(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var body tribeOverride
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Ipods) == 0 {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	overrides := upsertTribeOverride(api.tribeOverrides(ctx), body)
	value, _ := json.Marshal(overrides)
	if err := api.ds.Property(ctx).Put(tribeNamesKey, string(value)); err != nil {
		log.Error(ctx, "Error saving tribe names", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	renameCachedTribes(overrides)
	w.WriteHeader(http.StatusNoContent)
}

// upsertTribeOverride replaces the name of the override most similar to the given iPods, or adds
// one. An empty name removes the override
func upsertTribeOverride(overrides []tribeOverride, o tribeOverride) []tribeOverride {
	best, bestOverlap := -1, 0.0
	for i, existing := range overrides {
		if overlap := tribeOverlap(existing.Ipods, o.Ipods); overlap >= tribeOverrideMinOverlap && overlap > bestOverlap {
			best, bestOverlap = i, overlap
		}
	}
	switch {
	case best >= 0 && o.Name == "":
		return slices.Delete(overrides, best, best+1)
	case best >= 0:
		overrides[best] = o
		return overrides
	case o.Name != "":
		return append(overrides, o)
	default:
		return overrides
	}
}

// renameCachedTribes applies tribe names to the cached data, without recomputing it. The cached
// data is replaced by an updated copy, as requests may be reading the current one
func renameCachedTribes(overrides []tribeOverride) {
	c := ipodDataCache
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, e := range c.entries {
		if e.data == nil {
			continue
		}
		d := *e.data
		d.tribes.tribes = slices.Clone(d.tribes.tribes)
		applyTribeOverrides(d.tribes.tribes, overrides)
		d.network.Tribes = d.tribes.tribes
		e.data = &d
	}
}

// iPod Radio history: the last radios each user started, to start them again

const (
	radioHistoryKey = "IpodRadioHistory"
	radioHistoryMax = 50
)

type radioHistoryEntry struct {
	SeedID      string    `json:"seedId"`
	Title       string    `json:"title"`
	Artist      string    `json:"artist"`
	Album       string    `json:"album,omitempty"`
	AlbumID     string    `json:"albumId,omitempty"`
	LibraryID   int       `json:"libraryId,omitempty"`
	LibraryName string    `json:"libraryName,omitempty"`
	Adventure   float64   `json:"adventure"`
	Surprise    bool      `json:"surprise,omitempty"` // Started with "Surprise me"
	StartedAt   time.Time `json:"startedAt"`
}

func (api *Router) radioHistory(ctx context.Context) ([]radioHistoryEntry, error) {
	user, _ := request.UserFrom(ctx)
	value, err := api.ds.UserProps(ctx).DefaultGet(user.ID, radioHistoryKey, "[]")
	if err != nil {
		return nil, err
	}
	history := []radioHistoryEntry{}
	if err := json.Unmarshal([]byte(value), &history); err != nil {
		log.Warn(ctx, "Ignoring unreadable iPod Radio history", err)
		return []radioHistoryEntry{}, nil
	}
	return history, nil
}

func (api *Router) saveRadioHistory(ctx context.Context, history []radioHistoryEntry) error {
	user, _ := request.UserFrom(ctx)
	value, _ := json.Marshal(history)
	return api.ds.UserProps(ctx).Put(user.ID, radioHistoryKey, string(value))
}

func (api *Router) getRadioHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	history, err := api.radioHistory(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod Radio history", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, history)
}

// addRadioHistory records a radio that was started. Starting the same song again moves it to the
// top; only the last radioHistoryMax radios are kept
func (api *Router) addRadioHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var entry radioHistoryEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil || entry.SeedID == "" {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	entry.StartedAt = time.Now()
	history, err := api.radioHistory(ctx)
	if err == nil {
		history = addToRadioHistory(history, entry)
		err = api.saveRadioHistory(ctx, history)
	}
	if err != nil {
		log.Error(ctx, "Error saving iPod Radio history", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, history)
}

func addToRadioHistory(history []radioHistoryEntry, entry radioHistoryEntry) []radioHistoryEntry {
	history = slices.DeleteFunc(history, func(e radioHistoryEntry) bool { return e.SeedID == entry.SeedID })
	history = append([]radioHistoryEntry{entry}, history...)
	return history[:min(radioHistoryMax, len(history))]
}

// deleteRadioHistory removes one radio (seedId) from the history, or clears it
func (api *Router) deleteRadioHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	seedID, _ := req.Params(r).String("seedId")
	history := []radioHistoryEntry{}
	var err error
	if seedID != "" {
		if history, err = api.radioHistory(ctx); err == nil {
			history = slices.DeleteFunc(history, func(e radioHistoryEntry) bool { return e.SeedID == seedID })
		}
	}
	if err == nil {
		err = api.saveRadioHistory(ctx, history)
	}
	if err != nil {
		log.Error(ctx, "Error updating iPod Radio history", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, history)
}
