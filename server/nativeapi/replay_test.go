package nativeapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/configtest"
	"github.com/navidrome/navidrome/db"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/persistence"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Replay and best copies endpoints", Ordered, func() {
	var api *Router
	var ds model.DataStore
	var adminCtx, aliceCtx, bobCtx context.Context

	BeforeAll(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.DbPath = filepath.Join(GinkgoT().TempDir(), "replay.db?_journal_mode=WAL")
		conf.Server.MusicFolder = "/replay/music"
		admin := model.User{ID: "replay-admin", UserName: "replay-admin", IsAdmin: true, NewPassword: "x"}
		adminCtx = request.WithUser(context.Background(), admin)
		db.Init(adminCtx)
		DeferCleanup(func() { Expect(tests.ClearDB()).To(Succeed()) })
		ds = persistence.New(db.Db())
		Expect(ds.User(adminCtx).Put(&admin)).To(Succeed())
		api = &Router{ds: ds}

		libs := []model.Library{
			{Name: "iPod A", Path: "/replay/music/a"},
			{Name: "iPod B", Path: "/replay/music/b"},
		}
		for i := range libs {
			Expect(ds.Library(adminCtx).Put(&libs[i])).To(Succeed())
		}
		a := model.Artist{ID: "ar-weezer", Name: "Weezer", OrderArtistName: "weezer"}
		Expect(ds.Artist(adminCtx).Put(&a)).To(Succeed())
		song := func(id string, lib model.Library, title string, track int, suffix string, bitRate int) {
			mf := model.MediaFile{
				ID: id, LibraryID: lib.ID, Path: id + "." + suffix, Title: title, TrackNumber: track, DiscNumber: 1,
				ArtistID: a.ID, Artist: a.Name, OrderArtistName: a.OrderArtistName,
				AlbumArtistID: a.ID, AlbumArtist: a.Name, OrderAlbumArtistName: a.OrderArtistName,
				Album: "Blue Album", AlbumID: "al-" + lib.Name, Suffix: suffix, BitRate: bitRate, Duration: 200,
				Participants: model.Participants{model.RoleArtist: model.ParticipantList{{Artist: a}}},
				Lyrics:       "[]",
			}
			if suffix == "flac" {
				mf.BitDepth, mf.SampleRate = 16, 44100
			}
			Expect(ds.MediaFile(adminCtx).Put(&mf)).To(Succeed())
		}
		song("a1", libs[0], "My Name Is Jonas", 1, "mp3", 128)
		song("a2", libs[0], "Buddy Holly", 7, "mp3", 320)
		song("b1", libs[1], "My Name Is Jonas", 1, "flac", 1000)
		song("b2", libs[1], "Buddy Holly", 7, "mp3", 128)
		song("b3", libs[1], "Say It Ain't So", 8, "mp3", 192)
		Expect(ds.Album(adminCtx).Put(&model.Album{
			ID: "al-iPod A", LibraryID: libs[0].ID, Name: "Blue Album",
			AlbumArtistID: a.ID, AlbumArtist: a.Name, OrderAlbumArtistName: a.OrderArtistName,
		})).To(Succeed())

		alice := model.User{ID: "alice", UserName: "alice", NewPassword: "x", Libraries: model.Libraries{libs[0], libs[1]}}
		bob := model.User{ID: "bob", UserName: "bob", NewPassword: "x", Libraries: model.Libraries{libs[0], libs[1]}}
		for _, u := range []model.User{alice, bob} {
			Expect(ds.User(adminCtx).Put(&u)).To(Succeed())
			Expect(ds.User(adminCtx).SetUserLibraries(u.ID, []int{libs[0].ID, libs[1].ID})).To(Succeed())
		}
		for _, u := range []struct {
			name string
			ctx  *context.Context
		}{{"alice", &aliceCtx}, {"bob", &bobCtx}} {
			user, err := ds.User(adminCtx).FindByUsername(u.name)
			Expect(err).ToNot(HaveOccurred())
			*u.ctx = request.WithUser(context.Background(), *user)
		}
	})

	replay := func(ctx context.Context, id string) *httptest.ResponseRecorder {
		r := chi.NewRouter()
		api.addReplayRoutes(r)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/replay/"+id, nil).WithContext(ctx))
		return w
	}
	replayTracks := func(ctx context.Context) []string {
		pls, err := ds.Playlist(ctx).GetAll(model.QueryOptions{})
		Expect(err).ToNot(HaveOccurred())
		var ids []string
		for _, p := range pls {
			user, _ := request.UserFrom(ctx)
			if p.Name != replayPlaylistName || p.OwnerID != user.ID {
				continue
			}
			full, err := ds.Playlist(ctx).GetWithTracks(p.ID, false, true)
			Expect(err).ToNot(HaveOccurred())
			for _, t := range full.Tracks {
				ids = append(ids, t.MediaFileID)
			}
		}
		return ids
	}

	Describe("Replay", func() {
		It("creates each user's own Replay playlist, adding each song once", func() {
			var first, second replayResponse
			w1 := replay(aliceCtx, "a1")
			Expect(w1.Code).To(Equal(http.StatusOK))
			Expect(json.Unmarshal(w1.Body.Bytes(), &first)).To(Succeed())
			Expect(first.Created).To(BeTrue())
			Expect(first.Added).To(BeTrue())
			Expect(first.PlaylistID).ToNot(BeEmpty())
			w2 := replay(aliceCtx, "b3")
			Expect(w2.Code).To(Equal(http.StatusOK))
			Expect(json.Unmarshal(w2.Body.Bytes(), &second)).To(Succeed())
			Expect(second.Created).To(BeFalse())
			Expect(second.PlaylistID).To(Equal(first.PlaylistID))
			w := replay(aliceCtx, "a1")
			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(w.Body.String()).To(ContainSubstring(`"added":false`))
			Expect(replayTracks(aliceCtx)).To(Equal([]string{"a1", "b3"}))

			Expect(replay(bobCtx, "a2").Code).To(Equal(http.StatusOK))
			Expect(replayTracks(bobCtx)).To(Equal([]string{"a2"}))
			Expect(replayTracks(aliceCtx)).To(Equal([]string{"a1", "b3"}))
		})

		It("rejects unknown songs", func() {
			Expect(replay(aliceCtx, "nope").Code).To(Equal(http.StatusNotFound))
		})
	})

	Describe("best copies", func() {
		It("finds a better copy of a song on another iPod", func() {
			w := httptest.NewRecorder()
			api.getIpodBestCopy(w, httptest.NewRequest(http.MethodGet, "/ipods/best?id=a1", nil).WithContext(aliceCtx))
			Expect(w.Code).To(Equal(http.StatusOK))
			var resp ipodBestResponse
			Expect(json.Unmarshal(w.Body.Bytes(), &resp)).To(Succeed())
			Expect(resp.Copies).To(Equal(2))
			Expect(resp.Best).ToNot(BeNil())
			Expect(resp.Best.ID).To(Equal("b1"))
			Expect(resp.Best.LibraryName).To(Equal("iPod B"))
		})

		It("completes an album from the other iPods", func() {
			w := httptest.NewRecorder()
			api.getIpodCompleteAlbum(w, httptest.NewRequest(http.MethodGet, "/ipods/album?id=al-iPod%20A", nil).WithContext(aliceCtx))
			Expect(w.Code).To(Equal(http.StatusOK))
			var resp ipodAlbumResponse
			Expect(json.Unmarshal(w.Body.Bytes(), &resp)).To(Succeed())
			var ids, statuses []string
			for _, t := range resp.Tracks {
				ids = append(ids, t.ID)
				statuses = append(statuses, t.Status)
			}
			Expect(ids).To(Equal([]string{"b1", "a2", "b3"}))
			Expect(statuses).To(Equal([]string{"better", "here", "added"}))
			Expect(resp.Ipods).To(Equal([]string{"iPod B"}))
		})
	})
})
