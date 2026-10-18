package persistence

import (
	"context"

	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/pocketbase/dbx"
)

var _ = Describe("IpodRepository", func() {
	var adminRepo model.IpodRepository
	unknownArtist := model.Artist{ID: consts.UnknownArtistID, Name: consts.UnknownArtist, OrderArtistName: "unknown artist"}

	ipodSong := func(id string, libraryID int, title string, artist model.Artist) model.MediaFile {
		s := mf(model.MediaFile{
			ID: id, Title: title, Path: "/ipod/" + id + ".mp3",
			ArtistID: artist.ID, Artist: artist.Name, OrderArtistName: artist.OrderArtistName,
			Duration: 100, Year: 1985,
		})
		s.LibraryID = libraryID
		return s
	}

	BeforeEach(func() {
		db := GetDBXBuilder()
		for _, lib := range []int{2, 3} {
			_, err := db.NewQuery("INSERT OR IGNORE INTO library (id, name, path) VALUES ({:id}, {:name}, {:path})").
				Bind(dbx.Params{"id": lib, "name": "iPod test " + string(rune('0'+lib)), "path": "/ipod/test" + string(rune('0'+lib))}).Execute()
			Expect(err).ToNot(HaveOccurred())
		}

		ctx := request.WithUser(log.NewContext(context.TODO()), adminUser)
		Expect(NewArtistRepository(ctx, db).Put(&unknownArtist)).To(Succeed())
		mr := NewMediaFileRepository(ctx, db)
		songs := []model.MediaFile{
			ipodSong("ipod-1", 1, "Ipod Shared Song", artistKraftwerk),
			ipodSong("ipod-2", 2, "ipod shared song ", artistKraftwerk),
			ipodSong("ipod-3", 3, "Ipod Shared Song (Remastered 2011)", artistKraftwerk),
			ipodSong("ipod-4", 2, "Ipod Pair Song", artistBeatles),
			ipodSong("ipod-5", 3, "Ipod Pair Song", artistBeatles),
			ipodSong("ipod-6", 3, "Ipod Lonely Song", artistBeatles),
			// Placeholders, which should be ignored
			ipodSong("ipod-7", 1, "Track 05", artistKraftwerk),
			ipodSong("ipod-8", 2, "Track 05", artistKraftwerk),
			ipodSong("ipod-9", 1, "Ipod Mystery Song", unknownArtist),
			ipodSong("ipod-10", 2, "Ipod Mystery Song", unknownArtist),
			ipodSong("ipod-11", 3, "Ipod Lonely Mystery", unknownArtist),
		}
		for i := range songs {
			Expect(mr.Put(&songs[i])).To(Succeed())
		}
		DeferCleanup(func() {
			_, _ = db.NewQuery("DELETE FROM media_file WHERE id LIKE 'ipod-%'").Execute()
			_, _ = db.NewQuery("DELETE FROM library WHERE id IN (2, 3)").Execute()
			_, _ = db.Delete("artist", dbx.HashExp{"id": unknownArtist.ID}).Execute()
		})

		adminRepo = NewIpodRepository(ctx, db)
	})

	It("finds the songs on the most iPods, matching title case and spacing", func() {
		songs, err := adminRepo.TopDuplicateSongs(10)
		Expect(err).ToNot(HaveOccurred())
		Expect(songs).ToNot(BeEmpty())
		Expect(songs[0].Title).To(Equal("Ipod Shared Song"))
		Expect(songs[0].IpodCount).To(Equal(3))
		Expect(songs[0].IpodNames).To(HaveLen(3))
		Expect(songs).To(ContainElement(HaveField("IpodCount", 2)))
	})

	It("merges versions of a song and ignores placeholder songs", func() {
		songs, err := adminRepo.TopDuplicateSongs(10)
		Expect(err).ToNot(HaveOccurred())
		Expect(songs).To(HaveEach(HaveField("Title", Not(ContainSubstring("Remastered")))))
		Expect(songs).ToNot(ContainElement(HaveField("Title", "Track 05")))
		Expect(songs).ToNot(ContainElement(HaveField("Artist", consts.UnknownArtist)))
	})

	It("returns songs found on only one iPod as gems", func() {
		gems, err := adminRepo.UniqueGems(10000)
		Expect(err).ToNot(HaveOccurred())
		Expect(gems).To(ContainElement(model.IpodGem{
			MediaFileID: "ipod-6", Title: "Ipod Lonely Song", Artist: artistBeatles.Name,
			LibraryID: 3, LibraryName: "iPod test 3",
		}))
		Expect(gems).ToNot(ContainElement(HaveField("Title", "Ipod Shared Song")))
		Expect(gems).ToNot(ContainElement(HaveField("Title", "Ipod Lonely Mystery")))
	})

	It("computes per-iPod stats", func() {
		stats, err := adminRepo.Stats()
		Expect(err).ToNot(HaveOccurred())
		var lib3 model.IpodStats
		for _, s := range stats {
			if s.LibraryID == 3 {
				lib3 = s
			}
		}
		Expect(lib3.SongCount).To(Equal(4))
		Expect(lib3.DistinctSongs).To(Equal(3))
		Expect(lib3.UniqueSongs).To(Equal(1))
		Expect(lib3.ArtistCount).To(Equal(2))
		Expect(lib3.AvgYear).To(BeNumerically("~", 1985))
	})

	It("counts songs per artist per iPod", func() {
		counts, err := adminRepo.ArtistCounts()
		Expect(err).ToNot(HaveOccurred())
		Expect(counts).To(ContainElement(model.IpodArtistCount{
			LibraryID: 3, ArtistID: artistBeatles.ID, ArtistName: artistBeatles.Name, SongCount: 2,
		}))
		Expect(counts).ToNot(ContainElement(HaveField("ArtistID", consts.UnknownArtistID)))
	})

	It("computes library-wide totals", func() {
		totals, err := adminRepo.Totals()
		Expect(err).ToNot(HaveOccurred())
		Expect(totals.SharedSongs).To(Equal(2))
		Expect(totals.DistinctSongs).To(BeNumerically(">", 3))
	})

	It("changes the data version when a scan finishes", func() {
		before, err := adminRepo.DataVersion()
		Expect(err).ToNot(HaveOccurred())
		Expect(NewLibraryRepository(request.WithUser(context.TODO(), adminUser), GetDBXBuilder()).ScanEnd(2)).To(Succeed())
		after, err := adminRepo.DataVersion()
		Expect(err).ToNot(HaveOccurred())
		Expect(after).ToNot(Equal(before))
	})

	It("only considers the iPods the user can access", func() {
		db := GetDBXBuilder()
		ur := NewUserRepository(request.WithUser(context.TODO(), adminUser), db)
		Expect(ur.SetUserLibraries(regularUser.ID, []int{2})).To(Succeed())
		DeferCleanup(func() { _ = ur.SetUserLibraries(regularUser.ID, []int{1}) })

		repo := NewIpodRepository(request.WithUser(log.NewContext(context.TODO()), regularUser), db)
		songs, err := repo.TopDuplicateSongs(10)
		Expect(err).ToNot(HaveOccurred())
		Expect(songs).To(BeEmpty())

		stats, err := repo.Stats()
		Expect(err).ToNot(HaveOccurred())
		Expect(stats).To(HaveLen(1))
		Expect(stats[0].LibraryID).To(Equal(2))
		Expect(stats[0].UniqueSongs).To(Equal(2))
	})
})
