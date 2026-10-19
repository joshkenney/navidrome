package songkey

import (
	"github.com/navidrome/navidrome/consts"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Key", func() {
	DescribeTable("ignores placeholder songs",
		func(title, artistID string) {
			Expect(Key(title, artistID, "Artist")).To(BeEmpty())
		},
		Entry("Track 05", "Track 05", "a1"),
		Entry("05 Track 05", "05 Track 05", "a1"),
		Entry("Track05", "Track05", "a1"),
		Entry("track_5", "track_5", "a1"),
		Entry("Audio Track 03", "Audio Track 03", "a1"),
		Entry("Piste 4", "Piste 4", "a1"),
		Entry("Untitled", "Untitled", "a1"),
		Entry("Untitled Track 2", "Untitled Track 2", "a1"),
		Entry("only digits", "07", "a1"),
		Entry("empty title", "  ", "a1"),
		Entry("placeholder with version suffix", "Track 05 (Live)", "a1"),
		Entry("unknown artist", "Hey Ya!", consts.UnknownArtistID),
		Entry("no artist", "Hey Ya!", ""),
	)

	DescribeTable("ignores songs by unknown artists, whatever their ID",
		func(artistName string) {
			Expect(Key("Hey Ya!", "some-scanner-id", artistName)).To(BeEmpty())
		},
		Entry("Navidrome's unknown artist", "[Unknown Artist]"),
		Entry("unknown artist", "Unknown Artist"),
		Entry("unknown", "Unknown"),
		Entry("various", "Various"),
	)

	DescribeTable("matches versions of the same song",
		func(title string) {
			Expect(Key(title, "a1", "Artist")).To(Equal(Key("Song", "a1", "Artist")))
		},
		Entry("different case and spacing", "  SONG  "),
		Entry("remastered in brackets", "Song (Remastered 2009)"),
		Entry("remaster after a dash", "Song - 2011 Remaster"),
		Entry("explicit", "Song [Explicit]"),
		Entry("live after a dash", "Song - Live at Wembley"),
		Entry("featured artist", "Song (feat. Someone)"),
		Entry("track number prefix", "05 - Song"),
		Entry("several suffixes", "Song (Live) [Remastered]"),
		Entry("single version", "Song - Single Version"),
	)

	DescribeTable("keeps different recordings apart",
		func(title string) {
			Expect(Key(title, "a1", "Artist")).ToNot(Equal(Key("Song", "a1", "Artist")))
		},
		Entry("remix", "Song (Remix)"),
		Entry("acoustic", "Song (Acoustic)"),
		Entry("live acoustic", "Song (Live Acoustic)"),
		Entry("instrumental", "Song - Instrumental"),
		Entry("other title", "Song 2"),
	)

	It("keeps titles that only look like placeholders", func() {
		Expect(Key("Tracks of My Tears", "a1", "Artist")).ToNot(BeEmpty())
		Expect(Key("99 Problems", "a1", "Artist")).To(Equal("99 problems|artist"))
		Expect(Key("1979", "a1", "Artist")).To(Equal("1979|artist"))
	})

	It("tells apart songs by different artists", func() {
		Expect(Key("Song", "a1", "Artist")).ToNot(Equal(Key("Song", "a2", "Other Artist")))
	})

	It("matches spellings of the same artist", func() {
		Expect(Key("Song", "a1", "The Spill Canvas")).To(Equal(Key("Song", "a2", "spill canvas")))
	})

	It("falls back to the artist ID when the name has no letters", func() {
		Expect(Key("Song", "a1", "")).To(Equal("song|a1"))
	})
})

var _ = Describe("ArtistKey", func() {
	DescribeTable("matches spellings of the same artist",
		func(a, b string) {
			Expect(ArtistKey(a)).To(Equal(ArtistKey(b)))
		},
		Entry("leading The", "The Spill Canvas", "Spill Canvas"),
		Entry("case", "the spill canvas", "SPILL CANVAS"),
		Entry("punctuation", "Panic! At The Disco", "Panic at the Disco"),
		Entry("ampersand", "Simon & Garfunkel", "Simon and Garfunkel"),
		Entry("plus", "Florence + The Machine", "Florence and the Machine"),
		Entry("apostrophe", "Guns N' Roses", "Guns N Roses"),
		Entry("slash", "AC/DC", "ACDC"),
		Entry("accents", "Beyoncé", "Beyonce"),
		Entry("extra spaces", "  Spill   Canvas ", "Spill Canvas"),
	)

	It("keeps different artists apart", func() {
		Expect(ArtistKey("The The")).To(Equal("the"))
		Expect(ArtistKey("Theory of a Deadman")).To(Equal("theory of a deadman"))
		Expect(ArtistKey("!!!")).To(Equal("!!!"))
	})
})
