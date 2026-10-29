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

var _ = Describe("ListeningRepository", func() {
	// A library and listeners not used by other tests
	const lib = 41
	listener := model.User{ID: "listen-me", UserName: "listen-me", Name: "Me"}
	friend := model.User{ID: "listen-friend", UserName: "listen-friend", Name: "Friend", ShareActivity: true}
	shy := model.User{ID: "listen-shy", UserName: "listen-shy", Name: "Shy"}

	artistA := model.Artist{ID: "listen-ar-a", Name: "Listen Artist A", OrderArtistName: "listen artist a"}
	artistB := model.Artist{ID: "listen-ar-b", Name: "Listen Artist B", OrderArtistName: "listen artist b"}

	song := func(id, title string, artist model.Artist, album string, year int) model.MediaFile {
		s := mf(model.MediaFile{
			ID: id, Title: title, Path: "/listen/" + id + ".mp3", Duration: 200, Year: year,
			ArtistID: artist.ID, Artist: artist.Name, AlbumArtistID: artist.ID, AlbumArtist: artist.Name,
			AlbumID: "listen-al-" + album, Album: album, OrderArtistName: artist.OrderArtistName,
		})
		s.LibraryID = lib
		return s
	}
	songs := model.MediaFiles{
		song("listen-1", "Morning Song", artistA, "First", 1994),
		song("listen-2", "Evening Song", artistA, "First", 1994),
		song("listen-3", "Night Song", artistB, "Second", 2005),
	}

	var db dbx.Builder
	var repo model.ListeningRepository
	day := func(d string, hour int) time.Time {
		t, _ := time.Parse("2006-01-02", d)
		return t.Add(time.Duration(hour) * time.Hour)
	}
	scrobble := func(user model.User, songID string, at time.Time) {
		_, err := db.Insert("scrobbles", dbx.Params{"media_file_id": songID, "user_id": user.ID, "submission_time": at.Unix()}).Execute()
		Expect(err).ToNot(HaveOccurred())
	}
	annotate := func(user model.User, itemType, itemID string, plays int, last time.Time) {
		_, err := db.Insert("annotation", dbx.Params{"user_id": user.ID, "item_type": itemType, "item_id": itemID,
			"play_count": plays, "play_date": last}).Execute()
		Expect(err).ToNot(HaveOccurred())
	}

	BeforeEach(func() {
		db = GetDBXBuilder()
		_, err := db.NewQuery("INSERT OR IGNORE INTO library (id, name, path) VALUES ({:id}, 'Listen iPod', '/listen')").
			Bind(dbx.Params{"id": lib}).Execute()
		Expect(err).ToNot(HaveOccurred())
		for _, u := range []model.User{listener, friend, shy} {
			_, err = db.NewQuery("INSERT OR IGNORE INTO user (id, user_name, name, password, share_activity, created_at, updated_at) " +
				"VALUES ({:id}, {:name}, {:display}, 'pw', {:share}, {:now}, {:now})").
				Bind(dbx.Params{"id": u.ID, "name": u.UserName, "display": u.Name, "share": u.ShareActivity, "now": time.Now()}).Execute()
			Expect(err).ToNot(HaveOccurred())
			_, err = db.NewQuery("INSERT OR IGNORE INTO user_library (user_id, library_id) VALUES ({:user}, {:lib})").
				Bind(dbx.Params{"user": u.ID, "lib": lib}).Execute()
			Expect(err).ToNot(HaveOccurred())
		}

		adminCtx := request.WithUser(log.NewContext(context.TODO()), adminUser)
		ar := NewArtistRepository(adminCtx, db)
		for _, a := range []model.Artist{artistA, artistB} {
			Expect(ar.Put(&a)).To(Succeed())
			_, err = db.NewQuery("INSERT OR IGNORE INTO library_artist (library_id, artist_id) VALUES ({:lib}, {:id})").
				Bind(dbx.Params{"lib": lib, "id": a.ID}).Execute()
			Expect(err).ToNot(HaveOccurred())
		}
		mr := NewMediaFileRepository(adminCtx, db)
		for _, s := range songs {
			Expect(mr.Put(&s)).To(Succeed())
		}

		// I listened on two days of June 2026, a week apart, and loved the "First" album long ago
		scrobble(listener, "listen-1", day("2026-06-01", 9))
		scrobble(listener, "listen-1", day("2026-06-01", 10))
		scrobble(listener, "listen-2", day("2026-06-08", 22))
		annotate(listener, "media_file", "listen-1", 20, day("2025-01-01", 0))
		annotate(listener, "media_file", "listen-2", 1, day("2026-06-08", 22))
		annotate(listener, "artist", artistA.ID, 21, day("2025-01-01", 0))
		// A friend who shares, and a shy listener who doesn't, both play artist B
		scrobble(friend, "listen-3", day("2026-06-02", 12))
		annotate(friend, "artist", artistB.ID, 7, day("2026-06-02", 12))
		scrobble(shy, "listen-3", day("2026-06-03", 12))
		annotate(shy, "artist", artistB.ID, 3, day("2026-06-03", 12))

		repo = NewListeningRepository(request.WithUser(log.NewContext(context.TODO()), listener), db)
	})

	AfterEach(func() {
		for _, table := range []string{"scrobbles", "annotation"} {
			_, err := db.Delete(table, dbx.In("user_id", listener.ID, friend.ID, shy.ID)).Execute()
			Expect(err).ToNot(HaveOccurred())
		}
		_, err := db.Delete("media_file", dbx.HashExp{"library_id": lib}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.Delete("library_artist", dbx.HashExp{"library_id": lib}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.Delete("artist", dbx.In("id", artistA.ID, artistB.ID)).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.Delete("user_library", dbx.HashExp{"library_id": lib}).Execute()
		Expect(err).ToNot(HaveOccurred())
		_, err = db.Delete("user", dbx.In("id", listener.ID, friend.ID, shy.ID)).Execute()
		Expect(err).ToNot(HaveOccurred())
	})

	Describe("Timeline", func() {
		It("returns the plays, days and favourites of a stretch of time", func() {
			t, err := repo.Timeline(listener.ID, model.TimelineOptions{
				From: day("2026-06-01", 0), To: day("2026-07-01", 0), Max: 10,
			})
			Expect(err).ToNot(HaveOccurred())
			Expect(t.Days).To(Equal([]model.ListeningDay{
				{Date: "2026-06-01", Plays: 2, Seconds: 400},
				{Date: "2026-06-08", Plays: 1, Seconds: 200},
			}))
			Expect(t.Totals).To(Equal(model.ListeningTotals{Plays: 3, Seconds: 600, Songs: 2, Albums: 1, Artists: 1}))
			Expect(t.TopSongs[0].ID).To(Equal("listen-1"))
			Expect(t.TopSongs[0].Plays).To(Equal(2))
			Expect(t.TopIpods).To(HaveLen(1))
			Expect(t.TopIpods[0].LibraryName).To(Equal("Listen iPod"))
			Expect(t.Plays).To(HaveLen(3))
			Expect(t.Plays[0].MediaFile.ID).To(Equal("listen-2"))
			Expect(t.First).To(Equal(day("2026-06-01", 9).Local()))
		})

		It("groups plays by the listener's days", func() {
			// 22:00 UTC on June 8 is already June 9 two hours east of UTC
			t, err := repo.Timeline(listener.ID, model.TimelineOptions{TZOffset: 120, Max: 1})
			Expect(err).ToNot(HaveOccurred())
			Expect(t.Days[len(t.Days)-1].Date).To(Equal("2026-06-09"))
		})

		It("pages the plays", func() {
			t, err := repo.Timeline(listener.ID, model.TimelineOptions{Offset: 2, Max: 10})
			Expect(err).ToNot(HaveOccurred())
			Expect(t.Plays).To(HaveLen(1))
			Expect(t.Totals.Plays).To(Equal(3))
		})

		It("narrows the plays list to some artists or iPods, keeping the totals", func() {
			t, err := repo.Timeline(friend.ID, model.TimelineOptions{Max: 10, ArtistIDs: []string{artistA.ID}})
			Expect(err).ToNot(HaveOccurred())
			Expect(t.Plays).To(BeEmpty())
			Expect(t.FilteredPlays).To(BeZero())
			Expect(t.Totals.Plays).To(Equal(1))

			t, err = repo.Timeline(listener.ID, model.TimelineOptions{Max: 10, ArtistIDs: []string{artistA.ID}, LibraryIDs: []int{lib}})
			Expect(err).ToNot(HaveOccurred())
			Expect(t.Plays).To(HaveLen(3))
			Expect(t.FilteredPlays).To(Equal(3))

			t, err = repo.Timeline(listener.ID, model.TimelineOptions{Max: 10, LibraryIDs: []int{lib + 1}})
			Expect(err).ToNot(HaveOccurred())
			Expect(t.Plays).To(BeEmpty())
			Expect(t.Totals.Plays).To(Equal(3))
		})

		It("is empty outside the listening", func() {
			t, err := repo.Timeline(listener.ID, model.TimelineOptions{From: day("2020-01-01", 0), To: day("2020-02-01", 0)})
			Expect(err).ToNot(HaveOccurred())
			Expect(t.Totals.Plays).To(BeZero())
			Expect(t.First).ToNot(BeZero())
		})
	})

	Describe("Holes", func() {
		var holes *model.Holes
		BeforeEach(func() {
			var err error
			holes, err = repo.Holes(model.HolesOptions{ForgottenBefore: day("2026-01-01", 0), Max: 10})
			Expect(err).ToNot(HaveOccurred())
		})

		It("tells how much of each iPod and decade was played", func() {
			Expect(holes.Ipods).To(ContainElement(model.Coverage{
				ID: "41", Name: "Listen iPod", LibraryID: lib, LibraryName: "Listen iPod", Total: 3, Played: 2,
			}))
			Expect(holes.Decades).To(ConsistOf(
				model.Coverage{ID: "1990", Name: "1990s", Total: 2, Played: 2},
				model.Coverage{ID: "2000", Name: "2000s", Total: 1, Played: 0},
			))
		})

		It("finds the artists and albums never played", func() {
			Expect(holes.Artists).To(HaveLen(1))
			Expect(holes.Artists[0].ID).To(Equal(artistB.ID))
			Expect(holes.Artists[0].Songs).To(Equal(1))
			Expect(holes.Albums).To(HaveLen(1))
			Expect(holes.Albums[0].Name).To(Equal("Second"))
			Expect(holes.Albums[0].Ipods).To(Equal(1))
			Expect(holes.Albums[0].LibraryName).To(Equal("Listen iPod"))
		})

		It("finds forgotten favourites", func() {
			Expect(holes.ForgottenArtist).To(HaveLen(1))
			Expect(holes.ForgottenArtist[0].ID).To(Equal(artistA.ID))
			Expect(holes.ForgottenSongs).To(HaveLen(1))
			Expect(holes.ForgottenSongs[0].ID).To(Equal("listen-1"))
			Expect(holes.ForgottenSongs[0].Plays).To(Equal(20))
		})

		It("finds what listeners who share play and I never have", func() {
			Expect(holes.Community).To(HaveLen(1))
			Expect(holes.Community[0].ID).To(Equal(artistB.ID))
			Expect(holes.Community[0].Listeners).To(Equal([]string{"listen-friend"}))
			Expect(holes.Community[0].Songs).To(Equal(1))
		})

		It("returns every listening day", func() {
			Expect(holes.Days).To(HaveLen(2))
		})
	})

	Describe("SearchUsers", func() {
		It("finds listeners who share, and me", func() {
			users, err := repo.SearchUsers("listen-", 10)
			Expect(err).ToNot(HaveOccurred())
			Expect(users).To(HaveLen(2))
			Expect([]string{users[0].ID, users[1].ID}).To(ConsistOf(listener.ID, friend.ID))
		})
	})

	Describe("SearchListens", func() {
		It("finds what listeners who share played", func() {
			listens, err := repo.SearchListens("song", 10)
			Expect(err).ToNot(HaveOccurred())
			ids := map[string]int{}
			for _, l := range listens {
				Expect(l.UserID).ToNot(Equal(shy.ID))
				ids[l.UserID+"/"+l.MediaFile.ID] = l.Plays
			}
			Expect(ids).To(HaveKeyWithValue("listen-me/listen-1", 2))
			Expect(ids).To(HaveKeyWithValue("listen-friend/listen-3", 1))
		})
	})
})
