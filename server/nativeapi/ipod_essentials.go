package nativeapi

import (
	"cmp"
	"net/http"
	"slices"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
)

// Essentials: the songs that define a tribe, the ones most of its iPods carry and few other iPods do

const (
	essentialsSize         = 25
	essentialsPerArtist    = 2    // For variety, no artist has more songs than this
	essentialsMinTribeHave = 2    // A song must be on at least this many of the tribe's iPods...
	essentialsMinShare     = 0.25 // ...and on at least this share of them
	essentialsMinLift      = 2.0  // ...and be at least this much more common in the tribe than outside it
)

// tribeEssentials returns the Essentials of each tribe: media file IDs, most essential first. A
// song scores the share of the tribe's iPods carrying it, minus the share of the other iPods
// carrying it, so songs everybody has, or only one iPod has, don't make it. A song must also be
// much more common in the tribe than outside it (see essentialsMinLift)
func tribeEssentials(idx *radioIndex, tribes ipodTribes, ipodIDs []int) map[int][]string {
	result := map[int][]string{}
	if idx == nil || len(tribes.tribes) == 0 {
		return result
	}
	tribeOf := make([]int, len(ipodIDs)) // iPod index -> tribe ID, -1 for free spirits
	for i, id := range ipodIDs {
		t, ok := tribes.byIpod[id]
		if !ok {
			t = -1
		}
		tribeOf[i] = t
	}
	sizes := map[int]int{}
	for _, t := range tribeOf {
		sizes[t]++
	}

	type candidate struct {
		song  int32
		score float64
		have  int
	}
	candidates := map[int][]candidate{}
	have := map[int]int{}
	for s, song := range idx.songs {
		if song.spoken || len(song.ipods) < essentialsMinTribeHave {
			continue
		}
		clear(have)
		for _, ipod := range song.ipods {
			have[tribeOf[ipod]]++
		}
		for t, n := range have {
			size := sizes[t]
			if t < 0 || n < essentialsMinTribeHave || float64(n) < essentialsMinShare*float64(size) {
				continue
			}
			others := len(ipodIDs) - size
			outShare := 0.0
			if others > 0 {
				outShare = float64(len(song.ipods)-n) / float64(others)
			}
			inShare := float64(n) / float64(size)
			if inShare < essentialsMinLift*outShare {
				continue
			}
			score := inShare - outShare
			if score > 0 {
				candidates[t] = append(candidates[t], candidate{song: int32(s), score: score, have: n})
			}
		}
	}

	for t, cs := range candidates {
		slices.SortFunc(cs, func(a, b candidate) int {
			return cmp.Or(cmp.Compare(b.score, a.score), cmp.Compare(b.have, a.have), cmp.Compare(a.song, b.song))
		})
		perArtist := map[int32]int{}
		var ids []string
		for _, c := range cs {
			song := idx.songs[c.song]
			if perArtist[song.artist] >= essentialsPerArtist {
				continue
			}
			perArtist[song.artist]++
			ids = append(ids, song.rep)
			if len(ids) == essentialsSize {
				break
			}
		}
		result[t] = ids
	}
	return result
}

type tribeEssentialsResponse struct {
	ID    int      `json:"id"`
	Name  string   `json:"name"`
	Songs []string `json:"songs"`
}

func (api *Router) getTribeEssentials(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid tribe id", http.StatusBadRequest)
		return
	}
	d, err := api.loadIpodData(ctx)
	if err != nil {
		log.Error(ctx, "Error loading iPod data", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	i := slices.IndexFunc(d.tribes.tribes, func(t ipodTribe) bool { return t.ID == id })
	if i < 0 {
		http.Error(w, "tribe not found", http.StatusNotFound)
		return
	}
	songs := d.essentials[id]
	if songs == nil {
		songs = []string{}
	}
	writeJSON(ctx, w, tribeEssentialsResponse{ID: id, Name: d.tribes.tribes[i].Name, Songs: songs})
}
