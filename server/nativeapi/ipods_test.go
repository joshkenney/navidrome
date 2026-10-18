package nativeapi

import (
	"fmt"

	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("iPod network and matching", func() {
	var stats []model.IpodStats
	var counts []model.IpodArtistCount

	count := func(lib int, artist string, songs int) model.IpodArtistCount {
		return model.IpodArtistCount{LibraryID: lib, ArtistID: artist, ArtistName: "Name " + artist, SongCount: songs}
	}

	BeforeEach(func() {
		stats = []model.IpodStats{
			{LibraryID: 1, Name: "Alice's iPod", SongCount: 30},
			{LibraryID: 2, Name: "Bob's iPod", SongCount: 20},
			{LibraryID: 3, Name: "Carol's iPod", SongCount: 10},
		}
		counts = []model.IpodArtistCount{
			// "everyone" is on every iPod, "niche" only on 1 and 2
			count(1, "everyone", 10), count(1, "niche", 10), count(1, "a-only", 10),
			count(2, "everyone", 5), count(2, "niche", 30),
			count(3, "everyone", 10),
		}
	})

	Describe("buildIpodNetwork", func() {
		It("links iPods by the Jaccard similarity of their artists", func() {
			n := buildIpodNetwork(stats, counts)
			Expect(n.Nodes).To(HaveLen(3))
			Expect(n.Nodes[0].ArtistCount).To(Equal(3))

			Expect(n.Edges).To(HaveLen(3))
			// Strongest edge first: 1-2 share 2 of 3 artists
			Expect(n.Edges[0].Source).To(Equal(1))
			Expect(n.Edges[0].Target).To(Equal(2))
			Expect(n.Edges[0].Weight).To(BeNumerically("~", 2.0/3.0))
			Expect(n.Edges[0].SharedCount).To(Equal(2))
			// niche: min(10,30)=10 beats everyone: min(10,5)=5
			Expect(n.Edges[0].SharedArtists).To(Equal([]string{"Name niche", "Name everyone"}))
		})

		It("does not link iPods without shared artists", func() {
			counts = []model.IpodArtistCount{count(1, "x", 1), count(2, "y", 1)}
			n := buildIpodNetwork(stats[:2], counts)
			Expect(n.Edges).To(BeEmpty())
		})
	})

	Describe("findIpodTwins", func() {
		It("returns the two most similar iPods", func() {
			twins := findIpodTwins(stats, counts)
			Expect(twins).ToNot(BeNil())
			Expect(twins.A.Name).To(Equal("Alice's iPod"))
			Expect(twins.B.Name).To(Equal("Bob's iPod"))
			Expect(twins.Weight).To(BeNumerically("~", 2.0/3.0))
			Expect(twins.SharedArtists).To(Equal([]string{"Name niche", "Name everyone"}))
		})

		It("returns nil when no iPods share artists", func() {
			counts = []model.IpodArtistCount{count(1, "x", 1), count(2, "y", 1)}
			Expect(findIpodTwins(stats[:2], counts)).To(BeNil())
		})
	})

	Describe("matchIpods", func() {
		It("ranks iPods sharing rarer artists higher", func() {
			res := matchIpods(stats, counts, []string{"everyone", "niche"})
			Expect(res.NotFound).To(BeEmpty())
			Expect(res.Matches).To(HaveLen(3))
			Expect(res.Matches[0].ID).To(Equal(2))
			Expect(res.Matches[0].Resonance).To(Equal(100))
			Expect(res.Matches[1].ID).To(Equal(1))
			Expect(res.Matches[2].ID).To(Equal(3))
			Expect(res.Matches[2].Resonance).To(BeNumerically("<", 50))
		})

		It("reports artists not found on any iPod", func() {
			res := matchIpods(stats, counts, []string{"a-only", "unknown", "a-only"})
			Expect(res.NotFound).To(Equal([]string{"unknown"}))
			Expect(res.Matches).To(HaveLen(1))
			Expect(res.Matches[0].ID).To(Equal(1))
			Expect(res.Matches[0].Matched).To(HaveLen(1))
		})

		It("returns no matches for an empty query", func() {
			res := matchIpods(stats, counts, nil)
			Expect(res.Matches).To(BeEmpty())
		})
	})

	Describe("summarizeSongs", func() {
		entry := func(key string, lib int, title string) model.IpodSongEntry {
			return model.IpodSongEntry{Key: key, LibraryID: lib, MediaFileID: key + "-" + title, Title: title, Artist: "Artist"}
		}

		It("finds duplicates and unique songs", func() {
			entries := []model.IpodSongEntry{
				entry("everywhere", 1, "Everywhere"), entry("everywhere", 2, "everywhere"), entry("everywhere", 3, "Everywhere"),
				entry("pair", 2, "Pair"), entry("pair", 3, "Pair"),
				entry("alone", 1, "Alone"),
				entry("alone2", 1, "Alone 2"),
			}
			summary := summarizeSongs(entries, stats)

			Expect(summary.distinctSongs).To(Equal(4))
			Expect(summary.sharedSongs).To(Equal(2))
			Expect(summary.topSongs).To(HaveLen(2))
			Expect(summary.topSongs[0].Title).To(Equal("Everywhere"))
			Expect(summary.topSongs[0].IpodCount).To(Equal(3))
			Expect(summary.topSongs[0].IpodNames).To(Equal([]string{"Alice's iPod", "Bob's iPod", "Carol's iPod"}))
			Expect(summary.topSongs[1].IpodCount).To(Equal(2))

			Expect(summary.gemPool).To(HaveLen(2))
			Expect(summary.gemPool).To(HaveEach(HaveField("LibraryName", "Alice's iPod")))

			Expect(stats[0].DistinctSongs).To(Equal(3))
			Expect(stats[0].UniqueSongs).To(Equal(2))
			Expect(stats[2].DistinctSongs).To(Equal(2))
			Expect(stats[2].UniqueSongs).To(Equal(0))
		})

		It("caps the gem pool and samples from it", func() {
			var entries []model.IpodSongEntry
			for i := range ipodGemPoolSize + 50 {
				entries = append(entries, entry(fmt.Sprint("song", i), 1, fmt.Sprint("Song ", i)))
			}
			summary := summarizeSongs(entries, stats)
			Expect(summary.gemPool).To(HaveLen(ipodGemPoolSize))
			Expect(summary.topSongs).To(BeEmpty())

			gems := sampleGems(summary.gemPool, ipodGemsCount)
			Expect(gems).To(HaveLen(ipodGemsCount))
			Expect(summary.gemPool).To(ContainElements(gems))
		})
	})
})
