package nativeapi

import (
	"fmt"

	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("iPod tribes", func() {
	var stats []model.IpodStats
	var counts []model.IpodArtistCount
	var genres []model.IpodGenreCount

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
		return findTribes(stats, counts, genres, ipodSimilarities(stats, counts), computeTasteScores(stats, counts))
	}

	BeforeEach(func() {
		stats, counts, genres = nil, nil, nil
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
		// 8 groups of 4 iPods (32 iPods, enough to aim for 8+ tribes), each group sharing its own
		// artists, and all of them sharing a couple of common artists
		stats, counts, genres = nil, nil, nil
		for g := range 8 {
			for k := range 4 {
				lib := g*4 + k + 1
				addIpod(lib, 2000, "", fmt.Sprint("g", g, "-a"), fmt.Sprint("g", g, "-b"), fmt.Sprint("g", g, "-c"),
					"everyone-1", "everyone-2")
			}
		}
		ts := tribes()
		Expect(len(ts.tribes)).To(BeNumerically(">=", tribeMinCount))
		for _, t := range ts.tribes {
			Expect(float64(t.Size)).To(BeNumerically("<=", tribeMaxShare*float64(len(stats))))
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

	It("capitalizes genres", func() {
		Expect(titleCase("hip-hop")).To(Equal("Hip-Hop"))
		Expect(titleCase("classic rock")).To(Equal("Classic Rock"))
		Expect(titleCase("r&b")).To(Equal("R&B"))
	})
})
