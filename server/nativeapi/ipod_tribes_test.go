package nativeapi

import (
	"fmt"

	"github.com/navidrome/navidrome/utils/songkey"

	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("iPod tribes", func() {
	var stats []model.IpodStats
	var counts []model.IpodArtistCount
	var genres []model.IpodGenreCount
	var overrides []tribeOverride

	// addIpod adds an iPod with 5 songs by each of the given artists, all of the given genre
	addIpod := func(lib int, year float64, genre string, artists ...string) {
		stats = append(stats, model.IpodStats{LibraryID: lib, Name: fmt.Sprint("iPod ", lib), AvgYear: year})
		for _, a := range artists {
			counts = append(counts, model.IpodArtistCount{Key: a, LibraryID: lib, ArtistID: a, ArtistName: "Name " + a, SongCount: 5})
		}
		if genre != "" {
			genres = append(genres, model.IpodGenreCount{LibraryID: lib, Genre: genre, SongCount: 5 * len(artists)})
		}
	}
	tribes := func() ipodTribes {
		return findTribes(stats, counts, genres, ipodSimilarities(stats, counts), computeTasteScores(stats, counts), overrides)
	}

	BeforeEach(func() {
		stats, counts, genres, overrides = nil, nil, nil, nil
		// Two groups of 4 iPods, sharing artists inside each group but not across, and a loner
		for lib := 1; lib <= 4; lib++ {
			addIpod(lib, 2004+float64(lib), "emo", "weezer", "saves the day", "jimmy eat world", fmt.Sprint("emo-extra", lib))
		}
		for lib := 5; lib <= 8; lib++ {
			addIpod(lib, 1972, "classic rock", "zeppelin", "floyd", "sabbath", fmt.Sprint("rock-extra", lib))
		}
		addIpod(9, 1990, "jazz", "coltrane")
	})

	It("finds groups of iPods sharing artists", func() {
		ts := tribes()
		Expect(ts.tribes).To(HaveLen(2))
		Expect(ts.tribes[0].Ipods).To(ConsistOf(1, 2, 3, 4))
		Expect(ts.tribes[1].Ipods).To(ConsistOf(5, 6, 7, 8))
		Expect(ts.byIpod[1]).To(Equal(ts.byIpod[4]))
		Expect(ts.byIpod[1]).ToNot(Equal(ts.byIpod[5]))
	})

	It("leaves iPods outside any group as free spirits", func() {
		Expect(tribes().byIpod[9]).To(Equal(-1))
	})

	It("is deterministic", func() {
		Expect(tribes().byIpod).To(Equal(tribes().byIpod))
	})

	It("names tribes after their genre and decade, and lists their signature artists", func() {
		ts := tribes()
		Expect(ts.tribes[0].Name).To(Equal("2000s Emo"))
		Expect(ts.tribes[1].Name).To(Equal("1970s Classic Rock"))
		// Artists on only one iPod of the tribe are below the 30% support threshold
		Expect(ts.tribes[0].Artists).To(ConsistOf("Name weezer", "Name saves the day", "Name jimmy eat world"))
		Expect(ts.tribes[0].Examples).To(HaveLen(2))
	})

	It("names tribes after their artists when there are no genres", func() {
		genres = nil
		Expect(tribes().tribes[0].Name).To(HaveSuffix(" crowd"))
	})

	It("tells tribes with the same name apart", func() {
		// Both groups are emo, which is distinctive as the loner has lots of jazz
		for i := range genres {
			if genres[i].Genre != "jazz" {
				genres[i].Genre = "emo"
			} else {
				genres[i].SongCount = 200
			}
		}
		for i := range stats {
			stats[i].AvgYear = 1995
		}
		ts := tribes()
		Expect(ts.tribes[0].Name).To(Equal("1990s Emo"))
		Expect(ts.tribes[1].Name).To(HavePrefix("1990s Emo ("))
	})

	It("names tribes after a distinctive genre, not one common everywhere", func() {
		// Rock is everywhere, metal only on the second group's iPods
		genres = nil
		for _, s := range stats {
			genres = append(genres, model.IpodGenreCount{LibraryID: s.LibraryID, Genre: "rock", SongCount: 20})
		}
		for lib := 5; lib <= 8; lib++ {
			genres = append(genres, model.IpodGenreCount{LibraryID: lib, Genre: "metal", SongCount: 10})
		}
		ts := tribes()
		Expect(ts.tribes[1].Name).To(Equal("1970s Metal"))
		Expect(ts.tribes[0].Name).To(HaveSuffix(" crowd"), "rock is not distinctive, so the artists name the tribe")
	})

	It("names a tribe after two genres when both stand out", func() {
		genres = nil
		for _, s := range stats {
			genres = append(genres, model.IpodGenreCount{LibraryID: s.LibraryID, Genre: "rock", SongCount: 20})
		}
		for lib := 5; lib <= 8; lib++ {
			genres = append(genres,
				model.IpodGenreCount{LibraryID: lib, Genre: "metal", SongCount: 10},
				model.IpodGenreCount{LibraryID: lib, Genre: "punk", SongCount: 9})
		}
		Expect(tribes().tribes[1].Name).To(Equal("1970s Metal & Punk"))
	})

	It("merges spellings of the same genre", func() {
		Expect(normalizeGenre("Hip Hop/Rap")).To(Equal("hip-hop"))
		Expect(normalizeGenre("Rap")).To(Equal("hip-hop"))
		Expect(normalizeGenre("Alternative & Punk")).To(Equal("alternative"))
		Expect(normalizeGenre("R&B/Soul")).To(Equal("r&b"))
		Expect(normalizeGenre(" Rock; Pop ")).To(Equal("rock"))
		Expect(normalizeGenre("Electronica")).To(Equal("electronic"))
	})

	It("splits large, loosely linked groups into finer tribes", func() {
		// 16 groups of 4 iPods (64 iPods, enough to aim for 15+ tribes), each group sharing its own
		// artists, and all of them sharing a couple of common artists
		stats, counts, genres = nil, nil, nil
		for g := range 16 {
			for k := range 4 {
				lib := g*4 + k + 1
				addIpod(lib, 2000, "", fmt.Sprint("g", g, "-a"), fmt.Sprint("g", g, "-b"), fmt.Sprint("g", g, "-c"),
					"everyone-1", "everyone-2")
			}
		}
		ts := tribes()
		Expect(ts.tribes).To(HaveLen(16))
		for _, t := range ts.tribes {
			Expect(t.Size).To(Equal(4))
		}
	})

	It("splits the largest tribes into sub-groups, without leaving iPods out", func() {
		// 2 big crowds of 30 iPods, each made of 3 sub-groups of 10 sharing their own artists
		stats, counts, genres = nil, nil, nil
		lib := 0
		for crowd := range 2 {
			for sub := range 3 {
				for range 10 {
					lib++
					addIpod(lib, 2000, "", fmt.Sprint("crowd", crowd, "-a"), fmt.Sprint("crowd", crowd, "-b"),
						fmt.Sprint("crowd", crowd, "-c"), fmt.Sprint("sub", crowd, sub, "-a"), fmt.Sprint("sub", crowd, sub, "-b"))
				}
			}
		}
		ts := tribes()
		Expect(len(ts.tribes)).To(BeNumerically(">=", 6))
		for _, id := range ts.byIpod {
			Expect(id).To(BeNumerically(">=", 0), "no iPod becomes a free spirit by splitting")
		}
	})

	It("finds the tribe a user fits in", func() {
		ts := tribes()
		fit := ts.userTribe([]model.IpodArtistPlays{{Key: "weezer", Plays: 30}, {Key: "saves the day", Plays: 10}})
		Expect(fit).ToNot(BeNil())
		Expect(fit.Name).To(Equal("2000s Emo"))
	})

	It("finds no tribe when a user's plays are split evenly", func() {
		ts := tribes()
		Expect(ts.userTribe([]model.IpodArtistPlays{{Key: "weezer", Plays: 20}, {Key: "zeppelin", Plays: 20}})).To(BeNil())
		Expect(ts.userTribe([]model.IpodArtistPlays{{Key: "weezer", Plays: 2}})).To(BeNil())
	})

	It("tells same-named tribes apart by genre, or by an artist with a real name", func() {
		Expect(tribeHint(ipodTribe{Name: "2000s Pop-Punk", Genre: "Alternative", Artists: []string{"#1"}})).To(Equal("Alternative"))
		Expect(tribeHint(ipodTribe{Name: "2000s Alternative", Genre: "Alternative", Artists: []string{"#1", "Jojo"}})).To(Equal("Jojo"))
		Expect(tribeHint(ipodTribe{Name: "Rock", Artists: []string{"#1"}})).To(BeEmpty())
	})

	It("capitalizes genres", func() {
		Expect(titleCase("hip-hop")).To(Equal("Hip-Hop"))
		Expect(titleCase("classic rock")).To(Equal("Classic Rock"))
		Expect(titleCase("r&b")).To(Equal("R&B"))
	})

	Describe("scenes", func() {
		key := func(name string) string { return songkey.ArtistKey(name) }

		It("names a tribe after the scene of its artists, whatever the genre tags say", func() {
			stats, counts, genres = nil, nil, nil
			emo := []string{key("Saves the Day"), key("Brand New"), key("Taking Back Sunday"), key("Get Up Kids")}
			for lib := 1; lib <= 4; lib++ {
				addIpod(lib, 2004, "alternative", append(emo, fmt.Sprint("extra", lib))...)
			}
			for lib := 5; lib <= 8; lib++ {
				addIpod(lib, 1972, "rock", "zeppelin", "floyd", "sabbath")
			}
			ts := tribes()
			Expect(ts.tribes[0].Scene).To(Equal("Emo"))
			Expect(ts.tribes[0].Name).To(Equal("2000s Emo"))
		})

		It("is not won by a scene just because its artist list is longer", func() {
			// 4 strong emo artists against 8 weaker pop-punk ones
			share, lift := map[string]float64{}, map[string]float64{}
			for _, name := range []string{"Saves the Day", "Brand New", "Taking Back Sunday", "Thursday"} {
				share[key(name)], lift[key(name)] = 0.8, 6
			}
			for _, name := range []string{"Blink-182", "Green Day", "Sum 41", "Good Charlotte", "New Found Glory",
				"Simple Plan", "Yellowcard", "Motion City Soundtrack"} {
				share[key(name)], lift[key(name)] = 0.5, 2
			}
			Expect(sceneOf(share, lift)).To(HavePrefix("Emo"))
		})

		It("names both scenes when they are close", func() {
			share, lift := map[string]float64{}, map[string]float64{}
			for _, name := range []string{"Saves the Day", "Brand New", "Taking Back Sunday"} {
				share[key(name)], lift[key(name)] = 0.7, 4
			}
			for _, name := range []string{"Blink-182", "Sum 41", "New Found Glory"} {
				share[key(name)], lift[key(name)] = 0.6, 4
			}
			Expect(sceneOf(share, lift)).To(Equal("Emo & Pop-Punk"))
		})

		It("needs several of the scene's artists", func() {
			share := map[string]float64{key("Brand New"): 1, key("Saves the Day"): 1}
			lift := map[string]float64{key("Brand New"): 3, key("Saves the Day"): 3}
			Expect(sceneOf(share, lift)).To(BeEmpty())
		})

		It("ignores scene artists found everywhere", func() {
			share := map[string]float64{key("Blink-182"): 1, key("Green Day"): 1, key("Sum 41"): 1}
			lift := map[string]float64{key("Blink-182"): 1, key("Green Day"): 1, key("Sum 41"): 1}
			Expect(sceneOf(share, lift)).To(BeEmpty())
		})
	})

	Describe("admin names", func() {
		It("renames the tribe with mostly the same iPods", func() {
			overrides = []tribeOverride{{Name: "The Sad Kids", Ipods: []int{1, 2, 3}}}
			ts := tribes()
			Expect(ts.tribes[0].Name).To(Equal("The Sad Kids"))
			Expect(ts.tribes[0].Custom).To(BeTrue())
			Expect(ts.tribes[1].Custom).To(BeFalse())
		})

		It("ignores names of tribes that changed too much", func() {
			overrides = []tribeOverride{{Name: "Old Name", Ipods: []int{1, 20, 21, 22, 23}}}
			Expect(tribes().tribes[0].Custom).To(BeFalse())
		})

		It("gives each name to one tribe only", func() {
			overrides = []tribeOverride{{Name: "Everyone", Ipods: []int{1, 2, 3, 4, 5, 6}}}
			ts := tribes()
			named := 0
			for _, t := range ts.tribes {
				if t.Custom {
					named++
				}
			}
			Expect(named).To(BeNumerically("<=", 1))
		})

		It("adds, replaces and removes names", func() {
			o := upsertTribeOverride(nil, tribeOverride{Name: "A", Ipods: []int{1, 2}})
			Expect(o).To(HaveLen(1))
			o = upsertTribeOverride(o, tribeOverride{Name: "B", Ipods: []int{1, 2, 3}})
			Expect(o).To(Equal([]tribeOverride{{Name: "B", Ipods: []int{1, 2, 3}}}))
			o = upsertTribeOverride(o, tribeOverride{Name: "", Ipods: []int{1, 2, 3}})
			Expect(o).To(BeEmpty())
		})
	})
})
