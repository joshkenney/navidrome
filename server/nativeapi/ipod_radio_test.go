package nativeapi

import (
	"fmt"
	"math/rand/v2"

	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("iPod Radio", func() {
	var stats []model.IpodStats

	entry := func(title, artist string, lib int) model.IpodSongEntry {
		key := title + "|" + artist
		return model.IpodSongEntry{Key: key, LibraryID: lib, MediaFileID: key, Title: title, Artist: artist}
	}
	// countsFrom derives the per-iPod artist counts from the song entries
	countsFrom := func(entries []model.IpodSongEntry) []model.IpodArtistCount {
		byLibArtist := map[[2]string]int{}
		var order [][2]string
		for _, e := range entries {
			k := [2]string{fmt.Sprint(e.LibraryID), artistOfSongKey(e.Key)}
			if _, ok := byLibArtist[k]; !ok {
				order = append(order, k)
			}
			byLibArtist[k]++
		}
		var counts []model.IpodArtistCount
		for _, k := range order {
			var lib int
			_, _ = fmt.Sscan(k[0], &lib)
			counts = append(counts, model.IpodArtistCount{Key: k[1], LibraryID: lib, ArtistID: k[1], ArtistName: k[1], SongCount: byLibArtist[k]})
		}
		return counts
	}
	opts := func(count int) radioOptions {
		return radioOptions{count: count, exclude: map[int32]bool{}, rng: rand.New(rand.NewPCG(1, 2))}
	}
	build := func(entries []model.IpodSongEntry) *radioIndex {
		counts := countsFrom(entries)
		return buildRadioIndex(entries, stats, counts, buildIpodNetwork(stats, counts).Edges)
	}
	titles := func(idx *radioIndex, picks []radioPick) []string {
		res := make([]string, len(picks))
		for i, p := range picks {
			res[i] = idx.songs[p.song].rep
		}
		return res
	}

	BeforeEach(func() {
		stats = nil
		for i := 1; i <= 6; i++ {
			stats = append(stats, model.IpodStats{LibraryID: i, Name: fmt.Sprint("iPod ", i)})
		}
	})

	It("favors songs found on more of the seed's iPods", func() {
		var entries []model.IpodSongEntry
		for lib := 1; lib <= 4; lib++ {
			entries = append(entries, entry("Seed", "seed-artist", lib))
		}
		for lib := 1; lib <= 4; lib++ {
			entries = append(entries, entry("Close", "close-artist", lib)) // On all 4 seed iPods
		}
		entries = append(entries, entry("Far", "far-artist", 1)) // On 1 seed iPod only
		idx := build(entries)

		var close, far int
		for i := range 50 {
			o := opts(1)
			o.rng = rand.New(rand.NewPCG(uint64(i), 7))
			picks := idx.recommend(idx.songOf("Seed|seed-artist"), -1, o)
			switch titles(idx, picks)[0] {
			case "Close|close-artist":
				close++
			case "Far|far-artist":
				far++
			}
		}
		Expect(close).To(BeNumerically(">", far))
	})

	It("scores a one-iPod overlap below a three-iPod one", func() {
		Expect(shrunkCosine(1, 3, 1)).To(BeNumerically("<", shrunkCosine(3, 3, 3)))
		Expect(shrunkCosine(0, 3, 3)).To(BeZero())
	})

	It("never repeats the seed or excluded songs, and keeps artists apart", func() {
		var entries []model.IpodSongEntry
		for lib := 1; lib <= 3; lib++ {
			entries = append(entries, entry("Seed", "seed", lib))
			for a := range 8 {
				for s := range 4 {
					entries = append(entries, entry(fmt.Sprint("Song ", s), fmt.Sprint("artist", a), lib))
				}
			}
		}
		idx := build(entries)
		o := opts(20)
		excluded := idx.songOf("Song 0|artist0")
		o.exclude[excluded] = true

		picks := idx.recommend(idx.songOf("Seed|seed"), -1, o)
		Expect(picks).To(HaveLen(20))
		perArtist := map[int32]int{}
		for i, p := range picks {
			Expect(p.song).ToNot(Equal(idx.songOf("Seed|seed")))
			Expect(p.song).ToNot(Equal(excluded))
			a := idx.songs[p.song].artist
			perArtist[a]++
			for j := max(0, i-radioArtistGap+1); j < i; j++ {
				Expect(idx.songs[picks[j].song].artist).ToNot(Equal(a), "artist repeated within the gap")
			}
		}
		for _, n := range perArtist {
			Expect(n).To(BeNumerically("<=", radioMaxPerArtist))
		}
	})

	It("uses the closest iPods for a song found on a single iPod", func() {
		entries := []model.IpodSongEntry{
			entry("Lonely", "lonely", 1),
			// iPods 1 and 2 share artists, so they are neighbours
			entry("A", "shared", 1), entry("B", "shared", 2),
			// A song on iPod 2 and 3, only reachable through the neighbour iPod
			entry("Neighbour Song", "other", 2), entry("Neighbour Song", "other", 3),
		}
		idx := build(entries)
		picks := idx.recommend(idx.songOf("Lonely|lonely"), -1, opts(5))
		Expect(titles(idx, picks)).To(ContainElement("Neighbour Song|other"))
	})

	It("is deterministic for a given random source", func() {
		var entries []model.IpodSongEntry
		for lib := 1; lib <= 3; lib++ {
			entries = append(entries, entry("Seed", "seed", lib))
			for a := range 10 {
				entries = append(entries, entry("Song", fmt.Sprint("artist", a), lib))
			}
		}
		idx := build(entries)
		a := titles(idx, idx.recommend(idx.songOf("Seed|seed"), -1, opts(10)))
		b := titles(idx, idx.recommend(idx.songOf("Seed|seed"), -1, opts(10)))
		Expect(a).To(Equal(b))
	})

	It("can go by the artist alone, when the seed song is on no iPod", func() {
		entries := []model.IpodSongEntry{
			entry("Hit", "seed", 1), entry("Hit", "seed", 2),
			entry("Other", "pal", 1), entry("Other", "pal", 2),
		}
		idx := build(entries)
		picks := idx.recommend(-1, idx.artistOf("seed"), opts(2))
		Expect(titles(idx, picks)).To(ContainElements("Hit|seed", "Other|pal"))
	})

	Describe("adventure", func() {
		// "common" is on every iPod, "rare" only on the seed's iPods
		var idx *radioIndex
		BeforeEach(func() {
			var entries []model.IpodSongEntry
			for lib := 1; lib <= 6; lib++ {
				entries = append(entries, entry("Common", "common", lib))
			}
			for lib := 1; lib <= 2; lib++ {
				entries = append(entries, entry("Seed", "seed", lib), entry("Rare", "rare", lib))
			}
			idx = build(entries)
		})

		It("prefers rare artists for deep cuts, and common ones for crowd-pleasers", func() {
			common, rare := idx.songOf("Common|common"), idx.songOf("Rare|rare")
			Expect(idx.prior(rare, 1)).To(BeNumerically(">", idx.prior(common, 1)))
			Expect(idx.prior(common, -1)).To(BeNumerically(">", idx.prior(rare, -1)))
		})

		It("picks surprise seeds found on several iPods", func() {
			rng := rand.New(rand.NewPCG(3, 4))
			for range 20 {
				s := idx.surpriseSeed(0, rng)
				Expect(len(idx.songs[s].ipods)).To(BeNumerically(">=", radioSurpriseMin))
			}
		})
	})
})
