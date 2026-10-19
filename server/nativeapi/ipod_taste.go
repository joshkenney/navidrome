package nativeapi

import (
	"cmp"
	"math"
	"slices"

	"github.com/navidrome/navidrome/model"
)

const (
	tasteTopArtists     = 3
	tasteMinDeepCutSong = 3  // An artist needs this many songs on an iPod to count as one of its deep cuts
	tasteMinPlays       = 20 // Plays needed before showing a user's own taste
)

// ipodTaste tells how mainstream or niche an iPod's music is. Score is a percentile among all
// iPods: 90 means the iPod's artists are rarer than on 90% of the iPods
type ipodTaste struct {
	Score    int      `json:"taste"`
	Label    string   `json:"tasteLabel"`
	DeepCuts []string `json:"deepCuts"`
	Anthems  []string `json:"anthems"`
	raw      float64
}

// tasteModel holds what is needed to score any collection of artists against the iPods
type tasteModel struct {
	rarity map[string]float64 // By artist Key
	raws   []float64          // Raw scores of all iPods, sorted
	byIpod map[int]ipodTaste
}

func tasteLabel(score int) string {
	switch {
	case score < 20:
		return "crowdPleaser"
	case score < 40:
		return "mainstream"
	case score < 60:
		return "balanced"
	case score < 80:
		return "crateDigger"
	default:
		return "deepCuts"
	}
}

// percentile returns the share (0-100) of the sorted values that are lower than v
func percentile(sorted []float64, v float64) int {
	if len(sorted) <= 1 {
		return 50
	}
	// Values outside the iPods' range (e.g. a user's own taste) are capped at 0 and 100
	below, _ := slices.BinarySearch(sorted, v)
	return min(100, int(math.Round(100*float64(below)/float64(len(sorted)-1))))
}

// rawTaste is the average rarity of the artists, weighted by their number of songs (or plays)
func rawTaste(weights map[string]int, rarity map[string]float64) (float64, int) {
	var sum float64
	total := 0
	for key, w := range weights {
		r, ok := rarity[key]
		if !ok || w <= 0 {
			continue
		}
		sum += float64(w) * r
		total += w
	}
	if total == 0 {
		return 0, 0
	}
	return sum / float64(total), total
}

// computeTasteScores scores each iPod by the rarity of its artists across all iPods, where
// rarity(artist) = ln(number of iPods / number of iPods with the artist)
func computeTasteScores(stats []model.IpodStats, counts []model.IpodArtistCount) tasteModel {
	sets, artists := artistsByIpod(counts)
	ipodsWith := map[string]int{}
	for _, set := range sets {
		for key := range set {
			ipodsWith[key]++
		}
	}
	m := tasteModel{rarity: make(map[string]float64, len(ipodsWith)), byIpod: map[int]ipodTaste{}}
	n := float64(max(len(sets), 1))
	for key, df := range ipodsWith {
		m.rarity[key] = math.Log(n / float64(df))
	}

	for _, s := range stats {
		raw, _ := rawTaste(sets[s.LibraryID], m.rarity)
		m.byIpod[s.LibraryID] = ipodTaste{raw: raw}
		m.raws = append(m.raws, raw)
	}
	slices.Sort(m.raws)

	for _, s := range stats {
		t := m.byIpod[s.LibraryID]
		t.Score = percentile(m.raws, t.raw)
		t.Label = tasteLabel(t.Score)
		t.DeepCuts, t.Anthems = signatureArtists(sets[s.LibraryID], ipodsWith, artists)
		m.byIpod[s.LibraryID] = t
	}
	return m
}

// signatureArtists returns the rarest artists the iPod has several songs by, and the most widely
// carried ones
func signatureArtists(set map[string]int, ipodsWith map[string]int, artists map[string]ipodArtistRef) ([]string, []string) {
	byName := func(a, b string) int { return cmp.Compare(artists[a].Name, artists[b].Name) }
	deep := topKeys(set, tasteTopArtists, func(key string) bool { return set[key] >= tasteMinDeepCutSong },
		func(a, b string) int {
			return cmp.Or(cmp.Compare(ipodsWith[a], ipodsWith[b]), cmp.Compare(set[b], set[a]), byName(a, b))
		})
	anthems := topKeys(set, tasteTopArtists, func(string) bool { return true },
		func(a, b string) int {
			return cmp.Or(cmp.Compare(ipodsWith[b], ipodsWith[a]), cmp.Compare(set[b], set[a]), byName(a, b))
		})
	names := func(keys []string) []string {
		res := make([]string, len(keys))
		for i, key := range keys {
			res[i] = artists[key].Name
		}
		return res
	}
	return names(deep), names(anthems)
}

// topKeys returns the first k keys accepted by keep, in the order given by compare, without
// sorting all of them
func topKeys(set map[string]int, k int, keep func(string) bool, compare func(a, b string) int) []string {
	top := make([]string, 0, k+1)
	for key := range set {
		if !keep(key) {
			continue
		}
		if len(top) == k && compare(key, top[k-1]) >= 0 {
			continue
		}
		pos, _ := slices.BinarySearchFunc(top, key, compare)
		top = slices.Insert(top, pos, key)
		if len(top) > k {
			top = top[:k]
		}
	}
	return top
}

// userTaste places the artists a user played among the iPods. Returns nil if the user played
// too few songs by artists found on the iPods
func (m tasteModel) userTaste(plays []model.IpodArtistPlays) *ipodTaste {
	weights := make(map[string]int, len(plays))
	for _, p := range plays {
		weights[p.Key] += p.Plays
	}
	raw, total := rawTaste(weights, m.rarity)
	if total < tasteMinPlays {
		return nil
	}
	score := percentile(m.raws, raw)
	return &ipodTaste{Score: score, Label: tasteLabel(score), DeepCuts: []string{}, Anthems: []string{}, raw: raw}
}
