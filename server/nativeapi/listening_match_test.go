package nativeapi

import (
	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("findListeningMatch", func() {
	plays := func(user, artist string, n int) model.ListenerArtistPlays {
		return model.ListenerArtistPlays{UserID: user, UserName: user, Name: "Name " + user,
			ArtistID: artist, ArtistName: "Artist " + artist, Plays: n}
	}

	It("picks the listener with the most similar artists, and their most played new artist", func() {
		r := findListeningMatch([]model.ListenerArtistPlays{
			plays("me", "a", 10), plays("me", "b", 5), plays("me", "c", 1),
			// josh shares a and b, and plays d and e that I don't
			plays("josh", "a", 3), plays("josh", "b", 2), plays("josh", "d", 1), plays("josh", "e", 9),
			// sam plays far more, but shares only c
			plays("sam", "c", 50), plays("sam", "f", 100),
		}, "me")
		Expect(r.Listener).ToNot(BeNil())
		Expect(r.Listener.ID).To(Equal("josh"))
		Expect(r.Artist.ID).To(Equal("e"))
		Expect(r.Venn.Mine).To(Equal(3))
		Expect(r.Venn.Shared).To(Equal(2))
		Expect(r.Venn.Theirs).To(Equal(4))
		Expect(r.Venn.SharedTop[0].ID).To(Equal("a"))
		Expect(r.Venn.MineOnly[0].ID).To(Equal("c"))
		Expect(r.Venn.TheirsOnly).To(HaveLen(2))
	})

	It("skips listeners with nothing new to recommend", func() {
		r := findListeningMatch([]model.ListenerArtistPlays{
			plays("me", "a", 1), plays("twin", "a", 5), plays("other", "z", 1),
		}, "me")
		Expect(r.Listener.ID).To(Equal("other"))
		Expect(r.Venn.Shared).To(BeZero())
	})

	It("recommends from the most active listener when I haven't played anything lately", func() {
		r := findListeningMatch([]model.ListenerArtistPlays{
			plays("quiet", "x", 1), plays("busy", "y", 30),
		}, "me")
		Expect(r.Listener.ID).To(Equal("busy"))
		Expect(r.Venn.Mine).To(BeZero())
		Expect(r.Venn.MineOnly).To(BeEmpty())
	})

	It("recommends nothing without other listeners", func() {
		r := findListeningMatch([]model.ListenerArtistPlays{plays("me", "a", 1)}, "me")
		Expect(r.Listener).To(BeNil())
		Expect(r.Artist).To(BeNil())
	})
})
