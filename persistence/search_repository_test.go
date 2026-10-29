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

	Describe("combined libraries", func() {
		// "Search Music" holds the folder of the "Search iPod" library: it is a combined library
		const parentID, childID = 30, 31

		BeforeEach(func() {
			db := GetDBXBuilder()
			ctx := request.WithUser(log.NewContext(context.TODO()), adminUser)
			for _, q := range []string{
				"INSERT INTO library (id, name, path) VALUES (30, 'Search Music', '/search-music')",
				"INSERT INTO library (id, name, path) VALUES (31, 'Search iPod', '/search-music/ipod')",
				"INSERT INTO album (id, name, library_id, song_count, created_at, updated_at) " +
					"VALUES ('search-al-p', 'Aggregated Album', 30, 1, datetime('now'), datetime('now'))",
				"INSERT INTO album (id, name, library_id, song_count, created_at, updated_at) " +
					"VALUES ('search-al-c', 'Aggregated Album', 31, 1, datetime('now'), datetime('now'))",
			} {
				_, err := db.NewQuery(q).Execute()
				Expect(err).ToNot(HaveOccurred())
			}
			mr := NewMediaFileRepository(ctx, db)
			for libraryID, s := range map[int]model.MediaFile{
				parentID: {ID: "search-p", Title: "Aggregated Tune", AlbumID: "search-al-p", Path: "ipod/tune.mp3"},
				childID:  {ID: "search-c", Title: "Aggregated Tune", AlbumID: "search-al-c", Path: "tune.mp3"},
			} {
				s := mf(s)
				s.LibraryID = libraryID // mf sets the default library
				Expect(mr.Put(&s)).To(Succeed())
			}
			DeferCleanup(func() {
				for _, q := range []string{
					"DELETE FROM media_file WHERE id IN ('search-p', 'search-c')",
					"DELETE FROM album WHERE id IN ('search-al-p', 'search-al-c')",
					"DELETE FROM library WHERE id IN (30, 31)",
				} {
					_, _ = db.NewQuery(q).Execute()
				}
			})
		})

		It("leaves out the songs of a library holding other libraries", func() {
			songs, err := repo.Songs(model.SearchOptions{Query: "aggregated tune", Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(songIDs(songs)).To(Equal([]string{"search-c"}))
		})

		It("leaves out its albums", func() {
			albums, err := repo.Albums(model.SearchOptions{Query: "aggregated album", Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(albums).To(HaveLen(1))
			Expect(albums[0].ID).To(Equal("search-al-c"))
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
