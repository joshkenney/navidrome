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
		for i := range genres {
			genres[i].Genre = "rock"
		}
		for i := range stats {
			stats[i].AvgYear = 1995
		}
		ts := tribes()
		Expect(ts.tribes[0].Name).To(Equal("1990s Rock"))
		Expect(ts.tribes[1].Name).To(HavePrefix("1990s Rock ("))
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
	})
})
