package persistence

import (
	"context"

	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("SearchRepository", func() {
	var repo model.SearchRepository

	BeforeEach(func() {
		repo = NewSearchRepository(request.WithUser(log.NewContext(context.TODO()), adminUser), GetDBXBuilder())
	})

	songIDs := func(songs model.MediaFiles) []string {
		ids := make([]string, len(songs))
		for i, s := range songs {
			ids[i] = s.ID
		}
		return ids
	}

	Describe("Songs", func() {
		It("finds songs by title, best matches first", func() {
			songs, err := repo.Songs(model.SearchOptions{Query: "come together", Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(songIDs(songs)).To(ConsistOf("1002", "3002"))
		})

		It("also finds songs by their lyrics", func() {
			songs, err := repo.Songs(model.SearchOptions{Query: "set of lyrics", Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(songIDs(songs)).To(Equal([]string{"1005"}))
		})

		It("doesn't look in the lyrics for very short queries", func() {
			songs, err := repo.Songs(model.SearchOptions{Query: "xx", Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(songs).To(BeEmpty())
		})

		It("returns nothing without a query or filters", func() {
			songs, err := repo.Songs(model.SearchOptions{Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(songs).To(BeEmpty())
		})

		It("pages the results", func() {
			first, err := repo.Songs(model.SearchOptions{Query: "antenna", Max: 2})
			Expect(err).ToNot(HaveOccurred())
			rest, err := repo.Songs(model.SearchOptions{Query: "antenna", Max: 2, Offset: 2})
			Expect(err).ToNot(HaveOccurred())
			Expect(first).To(HaveLen(2))
			Expect(rest).To(HaveLen(1))
			Expect(songIDs(rest)).ToNot(ContainElements(songIDs(first)))
		})
	})

	Describe("Albums", func() {
		It("finds albums by name", func() {
			albums, err := repo.Albums(model.SearchOptions{Query: "abbey", Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(albums).To(HaveLen(2))
		})

		It("finds albums by year alone", func() {
			albums, err := repo.Albums(model.SearchOptions{YearFrom: 1967, YearTo: 1967, Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(albums).To(HaveLen(1))
			Expect(albums[0].ID).To(Equal(albumSgtPeppers.ID))
		})

		It("filters by year", func() {
			albums, err := repo.Albums(model.SearchOptions{Query: "abbey", YearFrom: 2000, Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(albums).To(HaveLen(1))
			Expect(albums[0].ID).To(Equal(albumWithVersion.ID))
		})
	})

	Describe("Artists", func() {
		It("finds artists by name", func() {
			artists, err := repo.Artists(model.SearchOptions{Query: "kraftwerk", Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(artists).To(HaveLen(1))
			Expect(artists[0].ID).To(Equal(artistKraftwerk.ID))
		})

		It("finds artists with albums from a year", func() {
			artists, err := repo.Artists(model.SearchOptions{Query: "the", YearFrom: 1960, YearTo: 1969, Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(artists).To(HaveLen(1))
			Expect(artists[0].ID).To(Equal(artistBeatles.ID))
		})
	})
})
