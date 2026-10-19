package persistence

import (
	"context"
	"fmt"

	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/utils/songkey"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/pocketbase/dbx"
)

var _ = Describe("IpodRepository", func() {
	// Library IDs not used by other tests, so their libraries' paths don't interfere
	const (
		lib2 = 32
		lib3 = 33
		lib4 = 34 // Holds the folders of lib2 and lib3
	)
	var adminRepo model.IpodRepository
	unknownArtist := model.Artist{ID: consts.UnknownArtistID, Name: consts.UnknownArtist, OrderArtistName: "unknown artist"}
	// Two spellings of the same artist, as tagged on different iPods
	spillCanvas := model.Artist{ID: "ipod-sc1", Name: "The Spill Canvas", OrderArtistName: "spill canvas"}
	spillCanvasLower := model.Artist{ID: "ipod-sc2", Name: "the spill canvas", OrderArtistName: "the spill canvas"}

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
		for _, lib := range []int{lib2, lib3} {
			_, err := db.NewQuery("INSERT OR IGNORE INTO library (id, name, path) VALUES ({:id}, {:name}, {:path})").
				Bind(dbx.Params{"id": lib, "name": fmt.Sprint("iPod test ", lib), "path": fmt.Sprint("/ipod/test", lib)}).Execute()
			Expect(err).ToNot(HaveOccurred())
		}
		// A library holding the folders of other libraries, which should be left out
		_, err := db.NewQuery("INSERT OR IGNORE INTO library (id, name, path) VALUES ({:id}, 'Combined', '/ipod/')").Bind(dbx.Params{"id": lib4}).Execute()
		Expect(err).ToNot(HaveOccurred())

		ctx := request.WithUser(log.NewContext(context.TODO()), adminUser)
		ar := NewArtistRepository(ctx, db)
		for _, a := range []*model.Artist{&unknownArtist, &spillCanvas, &spillCanvasLower} {
			Expect(ar.Put(a)).To(Succeed())
		}
		mr := NewMediaFileRepository(ctx, db)
		songs := []model.MediaFile{
			ipodSong("ipod-1", 1, "Ipod Shared Song", artistKraftwerk),
			ipodSong("ipod-2", lib2, "ipod shared song ", artistKraftwerk),
			ipodSong("ipod-3", lib3, "Ipod Shared Song (Remastered 2011)", artistKraftwerk),
			ipodSong("ipod-4", lib2, "Ipod Pair Song", artistBeatles),
			ipodSong("ipod-5", lib3, "Ipod Pair Song", artistBeatles),
			ipodSong("ipod-6", lib3, "Ipod Lonely Song", artistBeatles),
			// Placeholders, which should be ignored
			ipodSong("ipod-7", 1, "Track 05", artistKraftwerk),
			ipodSong("ipod-8", lib2, "Track 05", artistKraftwerk),
			ipodSong("ipod-9", 1, "Ipod Mystery Song", unknownArtist),
			ipodSong("ipod-10", lib2, "Ipod Mystery Song", unknownArtist),
			ipodSong("ipod-11", lib3, "Ipod Lonely Mystery", unknownArtist),
			// Copies in the combined library
			ipodSong("ipod-12", lib4, "Ipod Lonely Song", artistBeatles),
			ipodSong("ipod-13", lib4, "Ipod Pair Song", artistBeatles),
			// The same song, by two spellings of the same artist
			ipodSong("ipod-14", lib2, "All Over You", spillCanvas),
			ipodSong("ipod-15", lib3, "All Over You", spillCanvasLower),
		}
		for i := range songs {
			Expect(mr.Put(&songs[i])).To(Succeed())
		}
		DeferCleanup(func() {
			_, _ = db.NewQuery("DELETE FROM media_file WHERE id LIKE 'ipod-%'").Execute()
			_, _ = db.NewQuery("DELETE FROM library WHERE id IN ({:a}, {:b}, {:c})").Bind(dbx.Params{"a": lib2, "b": lib3, "c": lib4}).Execute()
			_, _ = db.Delete("artist", dbx.HashExp{"id": []any{unknownArtist.ID, spillCanvas.ID, spillCanvasLower.ID}}).Execute()
		})

		adminRepo = NewIpodRepository(ctx, db)
	})

	// iPodsWith returns the iPods each song (by key) is found on
	iPodsWith := func(entries []model.IpodSongEntry) map[string][]int {
		res := map[string][]int{}
		for _, e := range entries {
			res[e.Key] = append(res[e.Key], e.LibraryID)
		}
		return res
	}
	key := songkey.Key

	It("indexes each song once per iPod, merging versions and case differences", func() {
		entries, err := adminRepo.SongIndex()
		Expect(err).ToNot(HaveOccurred())
		found := iPodsWith(entries)
		Expect(found[key("Ipod Shared Song", artistKraftwerk.ID, artistKraftwerk.OrderArtistName)]).To(ConsistOf(1, lib2, lib3))
		Expect(found[key("Ipod Pair Song", artistBeatles.ID, artistBeatles.OrderArtistName)]).To(ConsistOf(lib2, lib3))
		Expect(found[key("Ipod Lonely Song", artistBeatles.ID, artistBeatles.OrderArtistName)]).To(ConsistOf(lib3))
	})

	It("matches songs and artists across spellings of the artist name", func() {
		entries, err := adminRepo.SongIndex()
		Expect(err).ToNot(HaveOccurred())
		found := iPodsWith(entries)
		Expect(found[key("All Over You", spillCanvas.ID, "spill canvas")]).To(ConsistOf(lib2, lib3))

		counts, err := adminRepo.ArtistCounts()
		Expect(err).ToNot(HaveOccurred())
		Expect(counts).To(ContainElements(
			And(HaveField("LibraryID", lib2), HaveField("Key", "spill canvas")),
			And(HaveField("LibraryID", lib3), HaveField("Key", "spill canvas")),
		))

		keys, err := adminRepo.ArtistKeys([]string{spillCanvas.ID, spillCanvasLower.ID, "missing"})
		Expect(err).ToNot(HaveOccurred())
		Expect(keys).To(Equal(map[string]string{spillCanvas.ID: "spill canvas", spillCanvasLower.ID: "spill canvas"}))
	})

	It("leaves out placeholder songs", func() {
		entries, err := adminRepo.SongIndex()
		Expect(err).ToNot(HaveOccurred())
		Expect(entries).ToNot(ContainElement(HaveField("Title", "Track 05")))
		Expect(entries).ToNot(ContainElement(HaveField("Title", "Ipod Mystery Song")))
		Expect(entries).ToNot(ContainElement(HaveField("Title", "Ipod Lonely Mystery")))
	})

	It("leaves out libraries that contain other libraries", func() {
		entries, err := adminRepo.SongIndex()
		Expect(err).ToNot(HaveOccurred())
		Expect(entries).ToNot(ContainElement(HaveField("LibraryID", lib4)))

		stats, err := adminRepo.Stats()
		Expect(err).ToNot(HaveOccurred())
		Expect(stats).ToNot(ContainElement(HaveField("LibraryID", lib4)))

		counts, err := adminRepo.ArtistCounts()
		Expect(err).ToNot(HaveOccurred())
		Expect(counts).ToNot(ContainElement(HaveField("LibraryID", lib4)))
	})

	It("computes per-iPod stats", func() {
		stats, err := adminRepo.Stats()
		Expect(err).ToNot(HaveOccurred())
		var ipod3 model.IpodStats
		for _, s := range stats {
			if s.LibraryID == lib3 {
				ipod3 = s
			}
		}
		Expect(ipod3.SongCount).To(Equal(5))
		Expect(ipod3.ArtistCount).To(Equal(3))
		Expect(ipod3.AvgYear).To(BeNumerically("~", 1985))
	})

	It("counts songs per artist per iPod", func() {
		counts, err := adminRepo.ArtistCounts()
		Expect(err).ToNot(HaveOccurred())
		Expect(counts).To(ContainElement(model.IpodArtistCount{
			Key: "beatles", LibraryID: lib3, ArtistID: artistBeatles.ID, ArtistName: artistBeatles.Name, SongCount: 2,
		}))
		Expect(counts).ToNot(ContainElement(HaveField("ArtistID", consts.UnknownArtistID)))
	})

	It("finds the most common decade", func() {
		totals, err := adminRepo.Totals()
		Expect(err).ToNot(HaveOccurred())
		Expect(totals.TopDecade).To(Equal(1980))
	})

	It("counts the current user's plays per artist", func() {
		db := GetDBXBuilder()
		_, err := db.NewQuery(`INSERT INTO annotation (user_id, item_id, item_type, play_count)
VALUES ({:user}, 'ipod-6', 'media_file', 25), ({:user}, 'ipod-15', 'media_file', 2), ({:user}, 'ipod-14', 'media_file', 3)`).
			Bind(dbx.Params{"user": adminUser.ID}).Execute()
		Expect(err).ToNot(HaveOccurred())
		DeferCleanup(func() {
			_, _ = db.NewQuery("DELETE FROM annotation WHERE item_id LIKE 'ipod-%'").Execute()
		})

		plays, err := adminRepo.UserArtistPlays()
		Expect(err).ToNot(HaveOccurred())
		Expect(plays).To(ContainElements(
			model.IpodArtistPlays{Key: "beatles", Plays: 25},
			// Both spellings of the artist are counted together
			model.IpodArtistPlays{Key: "spill canvas", Plays: 5},
		))
	})

	It("changes the data version when a scan finishes", func() {
		before, err := adminRepo.DataVersion()
		Expect(err).ToNot(HaveOccurred())
		Expect(NewLibraryRepository(request.WithUser(context.TODO(), adminUser), GetDBXBuilder()).ScanEnd(lib2)).To(Succeed())
		after, err := adminRepo.DataVersion()
		Expect(err).ToNot(HaveOccurred())
		Expect(after).ToNot(Equal(before))
	})

	It("only considers the iPods the user can access", func() {
		db := GetDBXBuilder()
		ur := NewUserRepository(request.WithUser(context.TODO(), adminUser), db)
		Expect(ur.SetUserLibraries(regularUser.ID, []int{lib2})).To(Succeed())
		DeferCleanup(func() { _ = ur.SetUserLibraries(regularUser.ID, []int{1}) })

		repo := NewIpodRepository(request.WithUser(log.NewContext(context.TODO()), regularUser), db)
		entries, err := repo.SongIndex()
		Expect(err).ToNot(HaveOccurred())
		Expect(entries).To(HaveEach(HaveField("LibraryID", lib2)))

		stats, err := repo.Stats()
		Expect(err).ToNot(HaveOccurred())
		Expect(stats).To(HaveLen(1))
		Expect(stats[0].LibraryID).To(Equal(lib2))

		// Users with different access get different versions, so they don't share cached data
		userVersion, err := repo.DataVersion()
		Expect(err).ToNot(HaveOccurred())
		adminVersion, err := adminRepo.DataVersion()
		Expect(err).ToNot(HaveOccurred())
		Expect(userVersion).ToNot(Equal(adminVersion))
	})
})
