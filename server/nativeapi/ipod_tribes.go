package nativeapi

import (
	"cmp"
	"fmt"
	"math"
	"slices"
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
	tribeUserMargin     = 1.1 // A user fits a tribe if it beats the runner-up by this factor
)

type ipodTribe struct {
	ID       int       `json:"id"`
	Name     string    `json:"name"`
	Size     int       `json:"size"`
	Decade   int       `json:"decade,omitempty"`
	Genre    string    `json:"genre,omitempty"`
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
func louvain(n int, pairs []ipodPair) []int {
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
		community, moved := louvainLevel(adj)
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
// until no move helps. Returns the communities, numbered from 0, and whether anything moved
func louvainLevel(adj []map[int]float64) ([]int, bool) {
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
			gain := func(c int) float64 { return links[c] - communityDegree[c]*degree[i]/total }
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

// titleCase turns "hip-hop" into "Hip-Hop"
func titleCase(s string) string {
	runes := []rune(s)
	for i, r := range runes {
		if i == 0 || runes[i-1] == ' ' || runes[i-1] == '-' || runes[i-1] == '/' {
			runes[i] = unicode.ToUpper(r)
		}
	}
	return string(runes)
}

// findTribes groups the iPods into tribes, and names each one after its most distinctive genre,
// its typical decade and its signature artists
func findTribes(stats []model.IpodStats, counts []model.IpodArtistCount, genres []model.IpodGenreCount,
	pairs []ipodPair, taste tasteModel) ipodTribes {
	result := ipodTribes{tribes: []ipodTribe{}, byIpod: map[int]int{}}
	membership := louvain(len(stats), pairs)

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
		genresByIpod[g.LibraryID][g.Genre] += g.SongCount
		genreTotals[g.Genre] += g.SongCount
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
		for key, c := range inTribe {
			share := float64(c) / float64(len(members))
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

		// Genre: common in the tribe, and more common than elsewhere
		tribeGenres := map[string]int{}
		tribeSongs := 0
		for _, i := range members {
			for g, c := range genresByIpod[stats[i].LibraryID] {
				tribeGenres[g] += c
				tribeSongs += c
			}
		}
		bestScore := 0.0
		for g, c := range tribeGenres {
			share := float64(c) / float64(tribeSongs)
			if share < tribeMinGenreShare {
				continue
			}
			lift := share / (float64(genreTotals[g]) / float64(allGenreSongs))
			if score := lift * share; score > bestScore || (score == bestScore && g < t.Genre) {
				bestScore, t.Genre = score, g
			}
		}
		t.Genre = titleCase(t.Genre)

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
	return result
}

func tribeName(t ipodTribe) string {
	switch {
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
