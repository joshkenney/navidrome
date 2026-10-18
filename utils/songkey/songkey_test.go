package songkey

import (
	"github.com/navidrome/navidrome/consts"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Key", func() {
	DescribeTable("ignores placeholder songs",
		func(title, artistID string) {
			Expect(Key(title, artistID)).To(BeEmpty())
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

	DescribeTable("matches versions of the same song",
		func(title string) {
			Expect(Key(title, "a1")).To(Equal(Key("Song", "a1")))
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
			Expect(Key(title, "a1")).ToNot(Equal(Key("Song", "a1")))
		},
		Entry("remix", "Song (Remix)"),
		Entry("acoustic", "Song (Acoustic)"),
		Entry("live acoustic", "Song (Live Acoustic)"),
		Entry("instrumental", "Song - Instrumental"),
		Entry("other title", "Song 2"),
	)

	It("keeps titles that only look like placeholders", func() {
		Expect(Key("Tracks of My Tears", "a1")).ToNot(BeEmpty())
		Expect(Key("99 Problems", "a1")).To(Equal("99 problems|a1"))
		Expect(Key("1979", "a1")).To(Equal("1979|a1"))
	})

	It("tells apart songs by different artists", func() {
		Expect(Key("Song", "a1")).ToNot(Equal(Key("Song", "a2")))
	})
})
