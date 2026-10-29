package persistence

import (
	"context"
	"time"

	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/pocketbase/dbx"
)

var _ = Describe("ErasRepository", func() {
	// A library and listener not used by other tests
	const lib = 42
	listener := model.User{ID: "eras-me", UserName: "eras-me"}

	song := func(id, title, artistID string, year, originalYear int) model.MediaFile {
		s := mf(model.MediaFile{
			ID: id, Title: title, Path: "/eras/" + id + ".mp3", Duration: 200,
			Year: year, OriginalYear: originalYear,
			ArtistID: artistID, Artist: "Artist " + artistID, AlbumArtistID: artistID, AlbumArtist: "Artist " + artistID,
			AlbumID: "eras-al-" + id, Album: "Album " + id, Genre: "Rock", Suffix: "mp3",
		})
		s.LibraryID = lib
		return s
	}
	songs := model.MediaFiles{
		song("eras-1", "Sixties One", "eras-a", 1965, 0),
		song("eras-2", "Sixties Two", "eras-a", 1968, 0),
		song("eras-3", "Sixties Three", "eras-a", 1969, 0),
		// A 2011 remaster of a 1969 song belongs to 1969
		song("eras-4", "Remastered", "eras-b", 2011, 1969),
		song("eras-5", "Nineties", "eras-c", 1994, 0),
		song("eras-6", "No Year", "eras-c", 0, 0),
		song("eras-7", "Typo Year", "eras-c", 1, 0),
	}
	podcast := song("eras-8", "Episode 1", "eras-d", 1966, 0)
	podcast.Genre = "Podcast"

	var db dbx.Builder
	var repo model.ErasRepository

	BeforeEach(func() {
		db = GetDBXBuilder()
		_, err := db.NewQuery("INSERT OR IGNORE INTO library (id, name, path) VALUES ({:id}, 'Eras iPod', '/eras')").
			Bind(dbx.Params{"id": lib}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.NewQuery("INSERT OR IGNORE INTO user (id, user_name, password, created_at, updated_at) " +
			"VALUES ({:id}, {:id}, 'pw', {:now}, {:now})").Bind(dbx.Params{"id": listener.ID, "now": time.Now()}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.NewQuery("INSERT OR IGNORE INTO user_library (user_id, library_id) VALUES ({:user}, {:lib})").
			Bind(dbx.Params{"user": listener.ID, "lib": lib}).Execute()
		Expect(err).ToNot(HaveOccurred())

		mr := NewMediaFileRepository(request.WithUser(log.NewContext(context.TODO()), adminUser), db)
		for _, s := range append(songs, podcast) {
			Expect(mr.Put(&s)).To(Succeed())
		}
		_, err = db.Insert("annotation", dbx.Params{"user_id": listener.ID, "item_type": "media_file",
			"item_id": "eras-1", "play_count": 3, "play_date": time.Now()}).Execute()
		Expect(err).ToNot(HaveOccurred())

		repo = NewErasRepository(request.WithUser(log.NewContext(context.TODO()), listener), db)
	})

	AfterEach(func() {
		_, err := db.Delete("annotation", dbx.HashExp{"user_id": listener.ID}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.Delete("media_file", dbx.HashExp{"library_id": lib}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.Delete("user_library", dbx.HashExp{"user_id": listener.ID}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.Delete("user", dbx.HashExp{"id": listener.ID}).Execute()
		Expect(err).ToNot(HaveOccurred())
	})

	Describe("Eras", func() {
		It("counts the music of each year, by when it first came out, without spoken word", func() {
			eras, err := repo.Eras()
			Expect(err).ToNot(HaveOccurred())
			Expect(eras.Years).To(Equal([]model.EraYear{
				{Year: 1965, Songs: 1, Albums: 1, Artists: 1, Played: 1},
				{Year: 1968, Songs: 1, Albums: 1, Artists: 1},
				{Year: 1969, Songs: 2, Albums: 2, Artists: 2},
				{Year: 1994, Songs: 1, Albums: 1, Artists: 1},
			}))
			Expect(eras.Undated).To(Equal(2))
		})
	})

	Describe("Era", func() {
		It("describes the music of a stretch of years", func() {
			era, err := repo.Era(1960, 1969, 10)
			Expect(err).ToNot(HaveOccurred())
			Expect(era.Songs).To(Equal(4))
			Expect(era.Played).To(Equal(1))
			Expect(era.Artists[0].ID).To(Equal("eras-a"))
			Expect(era.Artists[0].Songs).To(Equal(3))
			Expect(era.Artists[0].Plays).To(Equal(1))
			Expect(era.Albums).To(HaveLen(4))
			Expect(era.Albums[0].LibraryName).To(Equal("Eras iPod"))
			Expect(era.Genres).To(Equal([]model.EraGenre{{Name: "Rock", Songs: 4}}))
			Expect(era.Ipods).To(HaveLen(1))
			Expect(era.Ipods[0].Songs).To(Equal(4))
		})
	})

	Describe("EraSongs", func() {
		ids := func(songs model.MediaFiles) []string {
			res := make([]string, len(songs))
			for i, s := range songs {
				res[i] = s.ID
			}
			return res
		}

		It("shuffles songs of the era, at most two per artist", func() {
			picked, err := repo.EraSongs(model.EraSongsOptions{From: 1960, To: 1969, Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(picked).To(HaveLen(3)) // two of artist A's three, and the remaster
			Expect(ids(picked)).To(ContainElement("eras-4"))
			Expect(ids(picked)).ToNot(ContainElement("eras-8"))
		})

		It("journeys through the years in order", func() {
			picked, err := repo.EraSongs(model.EraSongsOptions{From: 1960, To: 1999, Max: 4, Journey: true})
			Expect(err).ToNot(HaveOccurred())
			Expect(picked).To(HaveLen(4))
			years := make([]int, len(picked))
			for i, s := range picked {
				years[i] = s.Year
				if s.OriginalYear > 0 {
					years[i] = s.OriginalYear
				}
			}
			for i := 1; i < len(years); i++ {
				Expect(years[i]).To(BeNumerically(">=", years[i-1]))
			}
			Expect(years[len(years)-1]).To(Equal(1994))
		})

		It("keeps only songs never played", func() {
			picked, err := repo.EraSongs(model.EraSongsOptions{From: 1965, To: 1965, Max: 10, Unplayed: true})
			Expect(err).ToNot(HaveOccurred())
			Expect(picked).To(BeEmpty())
		})

		It("keeps only a genre", func() {
			picked, err := repo.EraSongs(model.EraSongsOptions{From: 1960, To: 1999, Max: 10, Genre: "jazz"})
			Expect(err).ToNot(HaveOccurred())
			Expect(picked).To(BeEmpty())
		})
	})

	Describe("evenlySpread", func() {
		It("takes years over the whole stretch when there are more years than songs", func() {
			var picks []dbEraPick
			for y := 1950; y < 2000; y++ {
				picks = append(picks, dbEraPick{ID: "x", Year: y})
			}
			spread := evenlySpread(picks, 5)
			years := make([]int, len(spread))
			for i, p := range spread {
				years[i] = p.Year
			}
			Expect(years).To(Equal([]int{1950, 1960, 1970, 1980, 1990}))
		})
	})
})
