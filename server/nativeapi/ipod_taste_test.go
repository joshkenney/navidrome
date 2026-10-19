package nativeapi

import (
	"fmt"

	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("iPod taste", func() {
	var stats []model.IpodStats
	var counts []model.IpodArtistCount

	count := func(lib int, artist string, songs int) model.IpodArtistCount {
		return model.IpodArtistCount{Key: artist, LibraryID: lib, ArtistID: artist, ArtistName: "Name " + artist, SongCount: songs}
	}

	BeforeEach(func() {
		stats = nil
		counts = nil
		for lib := 1; lib <= 5; lib++ {
			stats = append(stats, model.IpodStats{LibraryID: lib, Name: fmt.Sprint("iPod ", lib)})
			counts = append(counts, count(lib, "everyone", 10)) // On every iPod
		}
		// iPod 1 is mostly a rare artist, iPod 5 only has the common one
		counts = append(counts, count(1, "rare", 20), count(2, "pair", 5), count(3, "pair", 5), count(4, "pair", 1))
	})

	It("scores iPods of rare artists higher than iPods of common ones", func() {
		m := computeTasteScores(stats, counts)
		Expect(m.byIpod[1].Score).To(Equal(100))
		Expect(m.byIpod[5].Score).To(Equal(0))
		Expect(m.byIpod[1].Label).To(Equal("deepCuts"))
		Expect(m.byIpod[5].Label).To(Equal("crowdPleaser"))
		Expect(m.byIpod[2].Score).To(BeNumerically(">", m.byIpod[4].Score))
	})

	It("finds each iPod's deep cuts and anthems", func() {
		m := computeTasteScores(stats, counts)
		Expect(m.byIpod[1].DeepCuts).To(Equal([]string{"Name rare", "Name everyone"}))
		Expect(m.byIpod[1].Anthems[0]).To(Equal("Name everyone"))
		// Only 1 song by "pair" on iPod 4: not enough for a deep cut
		Expect(m.byIpod[4].DeepCuts).To(Equal([]string{"Name everyone"}))
	})

	It("places a user's plays among the iPods", func() {
		m := computeTasteScores(stats, counts)
		niche := m.userTaste([]model.IpodArtistPlays{{Key: "rare", Plays: 30}})
		Expect(niche).ToNot(BeNil())
		Expect(niche.Score).To(Equal(100))

		mainstream := m.userTaste([]model.IpodArtistPlays{{Key: "everyone", Plays: 30}})
		Expect(mainstream.Score).To(Equal(0))
	})

	It("needs enough plays of artists found on the iPods", func() {
		m := computeTasteScores(stats, counts)
		Expect(m.userTaste([]model.IpodArtistPlays{{Key: "rare", Plays: 5}})).To(BeNil())
		Expect(m.userTaste([]model.IpodArtistPlays{{Key: "unknown", Plays: 500}})).To(BeNil())
	})

	It("labels scores", func() {
		Expect([]string{tasteLabel(5), tasteLabel(25), tasteLabel(50), tasteLabel(70), tasteLabel(95)}).
			To(Equal([]string{"crowdPleaser", "mainstream", "balanced", "crateDigger", "deepCuts"}))
	})
})
