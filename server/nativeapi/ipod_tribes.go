package nativeapi

import (
	"cmp"
	"fmt"
	"math"
	"slices"
	"strings"
	"unicode"

	"github.com/navidrome/navidrome/model"
)

// Taste tribes: groups of iPods with similar artists, found with the Louvain community detection
// method on the iPod similarity graph, and named after what is distinctive about them

const (
	tribeMinSize        = 3    // Smaller groups are "free spirits"
	tribeMinGenreShare  = 0.05 // A tribe's genre must be at least this share of its songs
	tribeMinArtistShare = 0.3  // A signature artist must be on at least this share of the tribe's iPods
	tribeTopArtists     = 3
	tribeExamples       = 2
	tribeUserMargin     = 1.1  // A user fits a tribe if it beats the runner-up by this factor
	tribeMinGenreLift   = 1.25 // A tribe's genre must be at least this much more common than overall
	tribeSecondGenre    = 0.6  // A second genre is named if it scores at least this share of the first

	// Tribe counts aimed for when there are enough iPods, and the largest share of iPods one tribe
	// may hold. Finer resolutions are tried until both hold
	tribeMinCount      = 8
	tribeMaxCount      = 15
	tribeTargetCount   = 12
	tribeMaxShare      = 0.25
	tribeMinIpodsSplit = tribeMinCount * tribeMinSize
)

// An admin's tribe name follows the tribe while at least this share of its iPods remain
const tribeOverrideMinOverlap = 0.5

var tribeResolutions = []float64{1.0, 1.25, 1.5, 1.75, 2, 2.5, 3, 4}

// genreSynonyms maps the many spellings of common genres (iTunes and others) to one name
var genreSynonyms = map[string]string{
	"alternative & punk": "alternative",
	"alt rock":           "alternative",
	"alternative rock":   "alternative",
	"alt-rock":           "alternative",
	"hip hop":            "hip-hop",
	"hiphop":             "hip-hop",
	"rap":                "hip-hop",
	"rap & hip-hop":      "hip-hop",
	"r&b/soul":           "r&b",
	"r & b":              "r&b",
	"rnb":                "r&b",
	"rhythm & blues":     "r&b",
	"electronica":        "electronic",
	"dance & electronic": "electronic",
	"electro":            "electronic",
}

type ipodTribe struct {
	ID       int       `json:"id"`
	Name     string    `json:"name"`
	Size     int       `json:"size"`
	Decade   int       `json:"decade,omitempty"`
	Genre    string    `json:"genre,omitempty"`
	Scene    string    `json:"scene,omitempty"`
	Custom   bool      `json:"custom,omitempty"` // Named by an admin
	Artists  []string  `json:"artists"`
	Ipods    []int     `json:"ipods"`
	Examples []ipodRef `json:"examples"`
	Taste    int       `json:"taste"`

	lift map[string]float64 // Artist Key -> how over-represented the artist is in the tribe
}

type ipodTribes struct {
	tribes []ipodTribe
	byIpod map[int]int // Library ID -> tribe ID, -1 for free spirits
}

// louvain groups the nodes of a weighted graph into communities, maximizing modularity. It visits
// nodes in order, so results are deterministic
func louvain(n int, pairs []ipodPair, resolution float64) []int {
	adj := make([]map[int]float64, n)
	for i := range adj {
		adj[i] = map[int]float64{}
	}
	for _, p := range pairs {
		adj[p.i][p.j] += p.weight
		adj[p.j][p.i] += p.weight
	}
	membership := make([]int, n)
	for i := range membership {
		membership[i] = i
	}
	for {
		community, moved := louvainLevel(adj, resolution)
		if !moved {
			return membership
		}
		for i := range membership {
			membership[i] = community[membership[i]]
		}
		adj = aggregate(adj, community)
	}
}

// louvainLevel moves each node to the neighbour community that increases modularity the most,
// until no move helps. Higher resolutions give more, smaller communities. Returns the
// communities, numbered from 0, and whether anything moved
func louvainLevel(adj []map[int]float64, resolution float64) ([]int, bool) {
	n := len(adj)
	degree := make([]float64, n)
	total := 0.0
	for i, row := range adj {
		for _, w := range row {
			degree[i] += w
		}
		total += degree[i]
	}
	community := make([]int, n)
	communityDegree := make([]float64, n)
	for i := range community {
		community[i] = i
		communityDegree[i] = degree[i]
	}
	if total == 0 {
		return community, false
	}

	movedAny := false
	for moved := true; moved; {
		moved = false
		for i := range n {
			current := community[i]
			communityDegree[current] -= degree[i]
			links := map[int]float64{}
			for j, w := range adj[i] {
				if j != i {
					links[community[j]] += w
				}
			}
			gain := func(c int) float64 { return links[c] - resolution*communityDegree[c]*degree[i]/total }
			best, bestGain := current, gain(current)
			candidates := make([]int, 0, len(links))
			for c := range links {
				candidates = append(candidates, c)
			}
			slices.Sort(candidates)
			for _, c := range candidates {
				if g := gain(c); g > bestGain+1e-12 {
					best, bestGain = c, g
				}
			}
			community[i] = best
			communityDegree[best] += degree[i]
			if best != current {
				moved, movedAny = true, true
			}
		}
	}

	// Number the communities from 0, in order of their first node
	renumber := map[int]int{}
	for i, c := range community {
		if _, ok := renumber[c]; !ok {
			renumber[c] = len(renumber)
		}
		community[i] = renumber[c]
	}
	return community, movedAny
}

// aggregate merges each community into a single node
func aggregate(adj []map[int]float64, community []int) []map[int]float64 {
	k := slices.Max(community) + 1
	merged := make([]map[int]float64, k)
	for i := range merged {
		merged[i] = map[int]float64{}
	}
	for i, row := range adj {
		for j, w := range row {
			merged[community[i]][community[j]] += w
		}
	}
	return merged
}

// chooseCommunities runs Louvain at increasing resolutions, until the iPods are split into a
// readable number of tribes, none of them holding too many of the iPods
func chooseCommunities(n int, pairs []ipodPair) []int {
	if n < tribeMinIpodsSplit {
		return louvain(n, pairs, 1)
	}
	var best []int
	bestCount, bestLargest := 0, n+1
	for _, resolution := range tribeResolutions {
		membership := louvain(n, pairs, resolution)
		sizes := map[int]int{}
		for _, c := range membership {
			sizes[c]++
		}
		count, largest := 0, 0
		for _, size := range sizes {
			if size >= tribeMinSize {
				count++
			}
			largest = max(largest, size)
		}
		if count >= tribeMinCount && count <= tribeMaxCount && float64(largest) <= tribeMaxShare*float64(n) {
			return membership
		}
		distance := func(c int) int { return max(c-tribeTargetCount, tribeTargetCount-c) }
		if best == nil || distance(count) < distance(bestCount) ||
			(distance(count) == distance(bestCount) && largest < bestLargest) {
			best, bestCount, bestLargest = membership, count, largest
		}
	}
	return best
}

// normalizeGenre keeps the first of several genres ("Rock; Pop", "Hip-Hop/Rap") and merges
// common spellings of the same genre
func normalizeGenre(genre string) string {
	g := strings.ToLower(strings.TrimSpace(genre))
	if synonym, ok := genreSynonyms[g]; ok {
		return synonym
	}
	if i := strings.IndexAny(g, ";/,|"); i > 0 {
		g = strings.TrimSpace(g[:i])
	}
	if synonym, ok := genreSynonyms[g]; ok {
		return synonym
	}
	return g
}

// titleCase turns "hip-hop" into "Hip-Hop", and "r&b" into "R&B"
func titleCase(s string) string {
	runes := []rune(s)
	for i, r := range runes {
		if i == 0 || strings.ContainsRune(" -/&", runes[i-1]) {
			runes[i] = unicode.ToUpper(r)
		}
	}
	return string(runes)
}

// findTribes groups the iPods into tribes, and names each one after its most distinctive genre,
// its typical decade and its signature artists
func findTribes(stats []model.IpodStats, counts []model.IpodArtistCount, genres []model.IpodGenreCount,
	pairs []ipodPair, taste tasteModel, overrides []tribeOverride) ipodTribes {
	result := ipodTribes{tribes: []ipodTribe{}, byIpod: map[int]int{}}
	membership := chooseCommunities(len(stats), pairs)

	groups := map[int][]int{} // Community -> indexes in stats
	for i, c := range membership {
		groups[c] = append(groups[c], i)
	}
	var big [][]int
	for _, members := range groups {
		if len(members) >= tribeMinSize {
			big = append(big, members)
		}
	}
	slices.SortFunc(big, func(a, b []int) int { return cmp.Or(cmp.Compare(len(b), len(a)), cmp.Compare(a[0], b[0])) })
	for _, s := range stats {
		result.byIpod[s.LibraryID] = -1
	}

	sets, artists := artistsByIpod(counts)
	ipodsWith := map[string]int{}
	for _, set := range sets {
		for key := range set {
			ipodsWith[key]++
		}
	}
	genresByIpod := map[int]map[string]int{}
	genreTotals := map[string]int{}
	allGenreSongs := 0
	for _, g := range genres {
		if genresByIpod[g.LibraryID] == nil {
			genresByIpod[g.LibraryID] = map[string]int{}
		}
		genre := normalizeGenre(g.Genre)
		genresByIpod[g.LibraryID][genre] += g.SongCount
		genreTotals[genre] += g.SongCount
		allGenreSongs += g.SongCount
	}
	weights := map[[2]int]float64{}
	for _, p := range pairs {
		weights[[2]int{p.i, p.j}] = p.weight
	}
	n := float64(len(stats))

	usedNames := map[string]bool{}
	for id, members := range big {
		t := ipodTribe{ID: id, Size: len(members), lift: map[string]float64{}}
		memberSet := map[int]bool{}
		for _, i := range members {
			memberSet[i] = true
			lib := stats[i].LibraryID
			t.Ipods = append(t.Ipods, lib)
			result.byIpod[lib] = id
		}

		// Signature artists: carried by many of the tribe's iPods, and by few of the others
		inTribe := map[string]int{}
		for _, i := range members {
			for key := range sets[stats[i].LibraryID] {
				inTribe[key]++
			}
		}
		var signature []string
		shares := make(map[string]float64, len(inTribe))
		for key, c := range inTribe {
			share := float64(c) / float64(len(members))
			shares[key] = share
			t.lift[key] = share / (float64(ipodsWith[key]) / n)
			if share >= tribeMinArtistShare {
				signature = append(signature, key)
			}
		}
		slices.SortFunc(signature, func(a, b string) int {
			return cmp.Or(cmp.Compare(t.lift[b], t.lift[a]), cmp.Compare(inTribe[b], inTribe[a]),
				cmp.Compare(artists[a].Name, artists[b].Name))
		})
		t.Artists = []string{}
		for _, key := range signature[:min(tribeTopArtists, len(signature))] {
			t.Artists = append(t.Artists, artists[key].Name)
		}

		t.Genre = distinctiveGenre(members, stats, genresByIpod, genreTotals, allGenreSongs)
		t.Scene = sceneOf(shares, t.lift)

		// Decade: the median of the members' average years
		var years []float64
		tasteSum := 0
		for _, i := range members {
			if stats[i].AvgYear > 0 {
				years = append(years, stats[i].AvgYear)
			}
			tasteSum += taste.byIpod[stats[i].LibraryID].Score
		}
		if len(years) > 0 {
			slices.Sort(years)
			t.Decade = int(math.Floor(years[len(years)/2]/10)) * 10
		}
		t.Taste = int(math.Round(float64(tasteSum) / float64(len(members))))

		// Examples: the members most connected to the rest of the tribe
		centrality := map[int]float64{}
		for _, a := range members {
			for _, b := range members {
				centrality[a] += weights[[2]int{min(a, b), max(a, b)}]
			}
		}
		examples := slices.Clone(members)
		slices.SortFunc(examples, func(a, b int) int { return cmp.Or(cmp.Compare(centrality[b], centrality[a]), cmp.Compare(a, b)) })
		for _, i := range examples[:min(tribeExamples, len(examples))] {
			t.Examples = append(t.Examples, ipodRef{ID: stats[i].LibraryID, Name: stats[i].Name})
		}

		t.Name = tribeName(t)
		if usedNames[t.Name] && len(t.Artists) > 0 {
			t.Name = fmt.Sprintf("%s (%s)", t.Name, t.Artists[0])
		}
		usedNames[t.Name] = true
		result.tribes = append(result.tribes, t)
	}
	applyTribeOverrides(result.tribes, overrides)
	return result
}

// tribeOverride is a name an admin gave to a tribe, remembered with the tribe's iPods
type tribeOverride struct {
	Name  string `json:"name"`
	Ipods []int  `json:"ipods"`
}

// tribeOverlap is the Jaccard similarity of two sets of iPods
func tribeOverlap(a, b []int) float64 {
	inA := make(map[int]bool, len(a))
	for _, id := range a {
		inA[id] = true
	}
	shared := 0
	for _, id := range b {
		if inA[id] {
			shared++
		}
	}
	union := len(a) + len(b) - shared
	if union == 0 {
		return 0
	}
	return float64(shared) / float64(union)
}

// applyTribeOverrides gives tribes the names admins chose. A name follows its tribe across rescans
// as long as at least half of the iPods are the same; each name is given to one tribe only
func applyTribeOverrides(tribes []ipodTribe, overrides []tribeOverride) {
	type match struct {
		tribe, override int
		overlap         float64
	}
	var matches []match
	for t := range tribes {
		for o, override := range overrides {
			if overlap := tribeOverlap(tribes[t].Ipods, override.Ipods); overlap >= tribeOverrideMinOverlap {
				matches = append(matches, match{tribe: t, override: o, overlap: overlap})
			}
		}
	}
	slices.SortFunc(matches, func(a, b match) int {
		return cmp.Or(cmp.Compare(b.overlap, a.overlap), cmp.Compare(a.tribe, b.tribe), cmp.Compare(a.override, b.override))
	})
	usedTribe, usedOverride := map[int]bool{}, map[int]bool{}
	for _, m := range matches {
		if usedTribe[m.tribe] || usedOverride[m.override] {
			continue
		}
		usedTribe[m.tribe], usedOverride[m.override] = true, true
		tribes[m.tribe].Name = overrides[m.override].Name
		tribes[m.tribe].Custom = true
	}
}

// distinctiveGenre returns the genre (or two) that sets the tribe apart: common among its songs,
// and clearly more common than among all songs. A genre that is as common everywhere (like Rock on
// most iPods) scores nothing, as ln(lift) is then about 0
func distinctiveGenre(members []int, stats []model.IpodStats, genresByIpod map[int]map[string]int,
	genreTotals map[string]int, allGenreSongs int) string {
	tribeGenres := map[string]int{}
	tribeSongs := 0
	for _, i := range members {
		for g, c := range genresByIpod[stats[i].LibraryID] {
			tribeGenres[g] += c
			tribeSongs += c
		}
	}
	type scored struct {
		genre string
		score float64
	}
	var candidates []scored
	for g, c := range tribeGenres {
		share := float64(c) / float64(tribeSongs)
		lift := share / (float64(genreTotals[g]) / float64(allGenreSongs))
		if share >= tribeMinGenreShare && lift >= tribeMinGenreLift {
			candidates = append(candidates, scored{genre: g, score: share * math.Log(lift)})
		}
	}
	if len(candidates) == 0 {
		return ""
	}
	slices.SortFunc(candidates, func(a, b scored) int {
		return cmp.Or(cmp.Compare(b.score, a.score), cmp.Compare(a.genre, b.genre))
	})
	genre := titleCase(candidates[0].genre)
	if len(candidates) > 1 && candidates[1].score >= tribeSecondGenre*candidates[0].score {
		genre += " & " + titleCase(candidates[1].genre)
	}
	return genre
}

func tribeName(t ipodTribe) string {
	switch {
	case t.Scene != "" && t.Decade > 0:
		return fmt.Sprintf("%ds %s", t.Decade, t.Scene)
	case t.Scene != "":
		return t.Scene
	case t.Genre != "" && t.Decade > 0:
		return fmt.Sprintf("%ds %s", t.Decade, t.Genre)
	case t.Genre != "":
		return t.Genre
	case len(t.Artists) >= 2:
		return fmt.Sprintf("%s & %s crowd", t.Artists[0], t.Artists[1])
	case len(t.Artists) == 1:
		return t.Artists[0] + " crowd"
	default:
		return fmt.Sprintf("Tribe %d", t.ID+1)
	}
}

// userTribe returns the tribe whose signature artists the user plays the most, or nil when no
// tribe clearly stands out
func (ts ipodTribes) userTribe(plays []model.IpodArtistPlays) *ipodTribe {
	total := 0
	for _, p := range plays {
		total += p.Plays
	}
	if total < tasteMinPlays || len(ts.tribes) == 0 {
		return nil
	}
	scores := make([]float64, len(ts.tribes))
	for i, t := range ts.tribes {
		for _, p := range plays {
			scores[i] += float64(p.Plays) * t.lift[p.Key]
		}
		scores[i] /= float64(total)
	}
	order := make([]int, len(scores))
	for i := range order {
		order[i] = i
	}
	slices.SortFunc(order, func(a, b int) int { return cmp.Or(cmp.Compare(scores[b], scores[a]), cmp.Compare(a, b)) })
	best := order[0]
	if scores[best] == 0 || (len(order) > 1 && scores[best] < scores[order[1]]*tribeUserMargin) {
		return nil
	}
	return &ts.tribes[best]
}
