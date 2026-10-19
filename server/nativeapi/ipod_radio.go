package nativeapi

import (
	"cmp"
	"hash/fnv"
	"math"
	"math/rand/v2"
	"slices"
	"strings"

	"github.com/navidrome/navidrome/model"
)

// iPod Radio: "people who carried this also carried...". Songs are recommended by how often they
// are found on the same iPods as the seed song (item-to-item collaborative filtering, with each
// iPod as one person's basket), mixed with songs by artists who share iPods with the seed's artist

const (
	radioDefaultCount  = 20
	radioMaxCount      = 50
	radioSimilarArtist = 15  // Similar artists considered
	radioArtistSongs   = 5   // Songs taken from each similar artist
	radioNeighbours    = 3   // Neighbour iPods used for songs found on a single iPod
	radioPoolSize      = 200 // Best candidates kept for sampling
	radioTemperature   = 0.7
	radioArtistGap     = 4 // No artist twice within this many songs
	radioMaxPerArtist  = 3
	radioSurpriseMin   = 3 // "Surprise me" seeds are found on at least this many iPods
)

type radioSong struct {
	rep    string  // ID of one of the song's media files
	artist int32   // Index in radioIndex.artists
	ipods  []int32 // Indexes of the iPods with the song, sorted
}

type radioArtist struct {
	name   string
	ipods  []int32 // Sorted
	songs  []int32 // Most widely carried first
	rarity float64
}

// radioIndex is a compact view of which songs and artists are on which iPods
type radioIndex struct {
	songs       []radioSong
	byKey       map[uint64]int32
	artists     []radioArtist
	artistByKey map[string]int32
	ipodSongs   [][]int32
	ipodArtists [][]int32
	neighbours  [][]int32 // Closest iPods of each iPod
	maxRarity   float64
}

func hashKey(key string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(key))
	return h.Sum64()
}

// artistOfSongKey returns the artist part of a song Key (see songkey.Key)
func artistOfSongKey(key string) string {
	return key[strings.LastIndex(key, "|")+1:]
}

func buildRadioIndex(entries []model.IpodSongEntry, stats []model.IpodStats, counts []model.IpodArtistCount, edges []ipodEdge) *radioIndex {
	idx := &radioIndex{byKey: map[uint64]int32{}, artistByKey: map[string]int32{}}
	ipodOf := make(map[int]int32, len(stats))
	for i, s := range stats {
		ipodOf[s.LibraryID] = int32(i)
	}
	idx.ipodSongs = make([][]int32, len(stats))
	idx.ipodArtists = make([][]int32, len(stats))
	idx.neighbours = make([][]int32, len(stats))

	_, refs := artistsByIpod(counts)
	artistIndex := func(key string) int32 {
		if a, ok := idx.artistByKey[key]; ok {
			return a
		}
		a := int32(len(idx.artists))
		idx.artists = append(idx.artists, radioArtist{name: refs[key].Name})
		idx.artistByKey[key] = a
		return a
	}
	for _, c := range counts {
		ipod, ok := ipodOf[c.LibraryID]
		if !ok {
			continue
		}
		a := artistIndex(c.Key)
		idx.artists[a].ipods = append(idx.artists[a].ipods, ipod)
		idx.ipodArtists[ipod] = append(idx.ipodArtists[ipod], a)
	}

	for _, e := range entries {
		ipod, ok := ipodOf[e.LibraryID]
		if !ok {
			continue
		}
		h := hashKey(e.Key)
		s, ok := idx.byKey[h]
		if !ok {
			s = int32(len(idx.songs))
			a := artistIndex(artistOfSongKey(e.Key))
			if idx.artists[a].name == "" {
				idx.artists[a].name = e.Artist
			}
			idx.songs = append(idx.songs, radioSong{rep: e.MediaFileID, artist: a})
			idx.byKey[h] = s
			idx.artists[a].songs = append(idx.artists[a].songs, s)
		}
		idx.songs[s].ipods = append(idx.songs[s].ipods, ipod)
		idx.ipodSongs[ipod] = append(idx.ipodSongs[ipod], s)
	}

	n := float64(max(len(stats), 1))
	for i := range idx.artists {
		a := &idx.artists[i]
		slices.Sort(a.ipods)
		a.ipods = slices.Compact(a.ipods)
		a.rarity = math.Log(n / float64(max(len(a.ipods), 1)))
		idx.maxRarity = max(idx.maxRarity, a.rarity)
		slices.SortStableFunc(a.songs, func(x, y int32) int {
			return cmp.Compare(len(idx.songs[y].ipods), len(idx.songs[x].ipods))
		})
	}
	for i := range idx.songs {
		slices.Sort(idx.songs[i].ipods)
	}

	// Edges come strongest first, so the first ones of each iPod are its closest neighbours
	for _, e := range edges {
		a, okA := ipodOf[e.Source]
		b, okB := ipodOf[e.Target]
		if !okA || !okB {
			continue
		}
		if len(idx.neighbours[a]) < radioNeighbours {
			idx.neighbours[a] = append(idx.neighbours[a], b)
		}
		if len(idx.neighbours[b]) < radioNeighbours {
			idx.neighbours[b] = append(idx.neighbours[b], a)
		}
	}
	return idx
}

// overlap counts the elements two sorted lists have in common
func overlap(a, b []int32) int {
	n, i, j := 0, 0, 0
	for i < len(a) && j < len(b) {
		switch {
		case a[i] == b[j]:
			n++
			i++
			j++
		case a[i] < b[j]:
			i++
		default:
			j++
		}
	}
	return n
}

// shrunkCosine is a cosine similarity that is lowered for small overlaps, so sharing a single
// iPod does not look as strong as sharing many
func shrunkCosine(shared, sizeA, sizeB int) float64 {
	if shared == 0 {
		return 0
	}
	return float64(shared) / (math.Sqrt(float64(sizeA*sizeB)) + 1)
}

// radioReason explains why a song was picked. The UI turns it into text
type radioReason struct {
	Type   string `json:"type"` // sharedIpods, artistFans, sameArtist or neighbour
	Count  int    `json:"count,omitempty"`
	From   string `json:"from,omitempty"`
	Artist string `json:"artist,omitempty"`
}

type radioPick struct {
	song   int32
	reason radioReason
}

type radioCandidate struct {
	song      int32
	score     float64
	shared    int     // iPods shared with the seed that contributed the most
	artistSim float64 // Similarity of the artist with that seed's artist
	from      int32   // That seed's artist
	neighbour bool    // Only found through a neighbour iPod of that seed
}

type radioOptions struct {
	count     int
	adventure float64 // -1 (crowd-pleasers) to 1 (deep cuts)
	exclude   map[int32]bool
	bias      map[int32]float64 // Artist -> score multiplier, from the listener's skips and likes
	rng       *rand.Rand
}

// radioSeed is a song (or, with song < 0, an artist) the radio is based on, and how much it counts
type radioSeed struct {
	song   int32
	artist int32
	weight float64
}

// prior favors widely carried songs, or songs by rare artists, depending on the adventure
func (idx *radioIndex) prior(s int32, adventure float64) float64 {
	song := idx.songs[s]
	rarity := 0.0
	if idx.maxRarity > 0 {
		rarity = idx.artists[song.artist].rarity / idx.maxRarity
	}
	return 0.05*math.Log(1+float64(len(song.ipods)))*(1-adventure) + 0.15*adventure*rarity
}

// seedScores is how strongly the candidate songs relate to one seed
type seedScores struct {
	seed      radioSeed
	ipods     []int32
	shared    map[int32]int
	neighbour map[int32]bool
	artistSim map[int32]float64 // By artist
}

// scoresFrom finds the songs related to a seed, adding them to the candidates
func (idx *radioIndex) scoresFrom(seed radioSeed, cands map[int32]bool) seedScores {
	sc := seedScores{seed: seed, shared: map[int32]int{}, neighbour: map[int32]bool{}, artistSim: map[int32]float64{}}
	if seed.song >= 0 {
		sc.ipods = idx.songs[seed.song].ipods
		sc.seed.artist = idx.songs[seed.song].artist
	}

	// Songs found on the same iPods as the seed
	for _, ipod := range sc.ipods {
		for _, s := range idx.ipodSongs[ipod] {
			sc.shared[s]++
			cands[s] = true
		}
	}
	// A song found on a single iPod says little about taste: also look at the closest iPods
	if len(sc.ipods) == 1 {
		for _, n := range idx.neighbours[sc.ipods[0]] {
			for _, s := range idx.ipodSongs[n] {
				if len(idx.songs[s].ipods) > 1 {
					sc.neighbour[s] = true
					cands[s] = true
				}
			}
		}
	}

	// Artists found on the same iPods as the seed artist
	if a := sc.seed.artist; a >= 0 {
		seedArtist := idx.artists[a]
		shared := map[int32]int{}
		for _, ipod := range seedArtist.ipods {
			for _, b := range idx.ipodArtists[ipod] {
				if b != a {
					shared[b]++
				}
			}
		}
		similar := make([]int32, 0, len(shared))
		for b, n := range shared {
			sc.artistSim[b] = shrunkCosine(n, len(seedArtist.ipods), len(idx.artists[b].ipods))
			similar = append(similar, b)
		}
		slices.SortFunc(similar, func(x, y int32) int {
			return cmp.Or(cmp.Compare(sc.artistSim[y], sc.artistSim[x]), cmp.Compare(x, y))
		})
		for _, b := range similar[:min(radioSimilarArtist, len(similar))] {
			songs := idx.artists[b].songs
			for _, s := range songs[:min(radioArtistSongs, len(songs))] {
				cands[s] = true
			}
		}
		// The seed artist's other songs, so a seed that is on no iPod still plays something
		for _, s := range seedArtist.songs[:min(radioArtistSongs, len(seedArtist.songs))] {
			cands[s] = true
		}
	}
	return sc
}

// recommend picks songs to play after the seed song. With seed < 0, only the seed artist is used
func (idx *radioIndex) recommend(seed int32, seedArtist int32, opts radioOptions) []radioPick {
	return idx.recommendFrom([]radioSeed{{song: seed, artist: seedArtist, weight: 1}}, opts)
}

// recommendFrom picks songs related to several seeds, weighted. The first seed is the anchor: the
// song (or artist) the radio was started from
func (idx *radioIndex) recommendFrom(seeds []radioSeed, opts radioOptions) []radioPick {
	if opts.count <= 0 {
		opts.count = radioDefaultCount
	}
	cands := map[int32]bool{}
	scores := make([]seedScores, len(seeds))
	totalWeight := 0.0
	isSeed := map[int32]bool{}
	for i, seed := range seeds {
		scores[i] = idx.scoresFrom(seed, cands)
		totalWeight += seed.weight
		if seed.song >= 0 {
			isSeed[seed.song] = true
		}
	}
	anchorArtist := scores[0].seed.artist

	pool := make([]*radioCandidate, 0, len(cands))
	for s := range cands {
		if isSeed[s] || opts.exclude[s] {
			continue
		}
		song := idx.songs[s]
		c := &radioCandidate{song: s}
		total, best := 0.0, -1.0
		for _, sc := range scores {
			songSim := shrunkCosine(sc.shared[s], len(sc.ipods), len(song.ipods))
			neighbour := sc.neighbour[s] && songSim == 0
			if neighbour {
				songSim = 0.25
			}
			artistSim := sc.artistSim[song.artist]
			contribution := sc.seed.weight * (0.6*songSim + 0.4*artistSim)
			total += contribution
			if contribution > best {
				best = contribution
				c.shared, c.artistSim, c.from, c.neighbour = sc.shared[s], artistSim, sc.seed.artist, neighbour
			}
		}
		c.score = total/totalWeight + idx.prior(s, opts.adventure)
		if song.artist == anchorArtist {
			c.score *= 0.5
		}
		if b, ok := opts.bias[song.artist]; ok {
			c.score *= b
		}
		if c.score > 0 {
			pool = append(pool, c)
		}
	}
	slices.SortFunc(pool, func(x, y *radioCandidate) int {
		return cmp.Or(cmp.Compare(y.score, x.score), cmp.Compare(x.song, y.song))
	})
	pool = pool[:min(radioPoolSize, len(pool))]

	return idx.sample(pool, anchorArtist, opts)
}

// sample draws songs at random, favoring the best scores, while keeping artists apart
func (idx *radioIndex) sample(pool []*radioCandidate, anchorArtist int32, opts radioOptions) []radioPick {
	weights := make([]float64, len(pool))
	for i, c := range pool {
		weights[i] = math.Pow(c.score, 1/radioTemperature)
	}
	used := make([]bool, len(pool))
	perArtist := map[int32]int{}
	var picks []radioPick
	var recent []int32

	allowed := func(c *radioCandidate) bool {
		a := idx.songs[c.song].artist
		if slices.Contains(recent, a) || perArtist[a] >= radioMaxPerArtist {
			return false
		}
		return a != anchorArtist || perArtist[a] < opts.count/2
	}

	for len(picks) < opts.count {
		total := 0.0
		for i, c := range pool {
			if !used[i] && allowed(c) {
				total += weights[i]
			}
		}
		if total == 0 {
			if len(recent) == 0 {
				break
			}
			recent = recent[1:] // Relax the artist gap rather than stopping early
			continue
		}
		r := opts.rng.Float64() * total
		chosen := -1
		for i, c := range pool {
			if used[i] || !allowed(c) {
				continue
			}
			chosen = i
			if r -= weights[i]; r <= 0 {
				break
			}
		}
		c := pool[chosen]
		used[chosen] = true
		a := idx.songs[c.song].artist
		perArtist[a]++
		recent = append(recent, a)
		if len(recent) > radioArtistGap-1 {
			recent = recent[1:]
		}
		picks = append(picks, radioPick{song: c.song, reason: idx.reasonFor(c, anchorArtist)})
	}
	return picks
}

func (idx *radioIndex) reasonFor(c *radioCandidate, anchorArtist int32) radioReason {
	artist := idx.artists[idx.songs[c.song].artist].name
	switch {
	case c.shared >= 2:
		return radioReason{Type: "sharedIpods", Count: c.shared}
	case idx.songs[c.song].artist == anchorArtist:
		return radioReason{Type: "sameArtist", Artist: artist}
	case c.artistSim > 0 && c.from >= 0:
		return radioReason{Type: "artistFans", From: idx.artists[c.from].name, Artist: artist}
	case c.neighbour:
		return radioReason{Type: "neighbour"}
	default:
		return radioReason{Type: "sharedIpods", Count: max(c.shared, 1)}
	}
}

// surpriseSeed picks a random song found on several iPods: widely carried ones for crowd-pleasers,
// songs by rarer artists for deep cuts
func (idx *radioIndex) surpriseSeed(adventure float64, rng *rand.Rand) int32 {
	var cands []int32
	var weights []float64
	total := 0.0
	for s, song := range idx.songs {
		if len(song.ipods) < radioSurpriseMin {
			continue
		}
		w := math.Pow(float64(len(song.ipods)), 1-adventure) *
			math.Pow(1+idx.artists[song.artist].rarity, 2*max(adventure, 0))
		cands = append(cands, int32(s))
		weights = append(weights, w)
		total += w
	}
	if len(cands) == 0 {
		if len(idx.songs) == 0 {
			return -1
		}
		return int32(rng.IntN(len(idx.songs)))
	}
	r := rng.Float64() * total
	for i, w := range weights {
		if r -= w; r <= 0 {
			return cands[i]
		}
	}
	return cands[len(cands)-1]
}

// songOf returns the index of the song with the given Key, or -1
func (idx *radioIndex) songOf(key string) int32 {
	if s, ok := idx.byKey[hashKey(key)]; ok {
		return s
	}
	return -1
}

// artistOf returns the index of the artist with the given Key, or -1
func (idx *radioIndex) artistOf(key string) int32 {
	if a, ok := idx.artistByKey[key]; ok {
		return a
	}
	return -1
}
