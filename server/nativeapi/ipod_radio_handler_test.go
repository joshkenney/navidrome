package nativeapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"

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

var _ = Describe("iPod Radio endpoint", Ordered, func() {
	var ctx context.Context
	var api *Router
	var ds model.DataStore

	BeforeAll(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.DbPath = filepath.Join(GinkgoT().TempDir(), "radio.db?_journal_mode=WAL")
		conf.Server.MusicFolder = "/radio/music"
		admin := model.User{ID: "radio-admin", UserName: "radio-admin", IsAdmin: true, NewPassword: "x"}
		ctx = request.WithUser(context.Background(), admin)
		db.Init(ctx)
		DeferCleanup(func() { Expect(tests.ClearDB()).To(Succeed()) })
		ds = persistence.New(db.Db())
		Expect(ds.User(ctx).Put(&admin)).To(Succeed())
		api = &Router{ds: ds}
		ipodDataCache.entries = map[string]*ipodCacheEntry{}

		// Library 1 ("/radio/music") holds both iPods' folders
		libs := []model.Library{
			{Name: "iPod A", Path: "/radio/music/a"},
			{Name: "iPod B", Path: "/radio/music/b"},
		}
		for i := range libs {
			Expect(ds.Library(ctx).Put(&libs[i])).To(Succeed())
		}
		artists := map[string]model.Artist{}
		artist := func(name, order string) model.Artist {
			a := model.Artist{ID: "ar-" + order, Name: name, OrderArtistName: order}
			Expect(ds.Artist(ctx).Put(&a)).To(Succeed())
			artists[name] = a
			return a
		}
		weezer := artist("Weezer", "weezer")
		blur := artist("Blur", "blur")
		pixies := artist("The Pixies", "pixies")
		song := func(id string, lib model.Library, title string, a model.Artist) {
			mf := model.MediaFile{
				ID: id, LibraryID: lib.ID, Path: id + ".mp3", Title: title,
				ArtistID: a.ID, Artist: a.Name, OrderArtistName: a.OrderArtistName,
				AlbumArtistID: a.ID, AlbumArtist: a.Name, Album: "Album " + a.Name,
				Participants: model.Participants{model.RoleArtist: model.ParticipantList{{Artist: a}}},
				Lyrics:       "[]",
			}
			Expect(ds.MediaFile(ctx).Put(&mf)).To(Succeed())
		}
		song("a1", libs[0], "Buddy Holly", weezer)
		song("a2", libs[0], "Song 2", blur)
		song("a3", libs[0], "Debaser", pixies)
		song("b1", libs[1], "Buddy Holly", weezer)
		song("b2", libs[1], "Song 2", blur)
		song("b3", libs[1], "Only On B", weezer)
		song("m1", model.Library{ID: model.DefaultLibraryID}, "In Music Library Only", pixies)
		song("t5", libs[0], "Track 05", weezer)
		stranger := artist("Nobody Knows", "nobody knows")
		song("x1", model.Library{ID: model.DefaultLibraryID}, "Stranger Song", stranger)
		for i := range 5 {
			song(fmt.Sprint("bx", i), libs[1], fmt.Sprint("Filler ", i), blur)
		}
	})

	radio := func(query string) (*httptest.ResponseRecorder, ipodRadioResponse) {
		r := httptest.NewRequest(http.MethodGet, "/ipods/radio?"+query, nil).WithContext(ctx)
		w := httptest.NewRecorder()
		api.getIpodRadio(w, r)
		var resp ipodRadioResponse
		if w.Code == http.StatusOK {
			Expect(json.Unmarshal(w.Body.Bytes(), &resp)).To(Succeed())
		}
		return w, resp
	}

	DescribeTable("plays songs for any seed",
		func(songID string) {
			w, resp := radio("songId=" + songID)
			Expect(w.Code).To(Equal(http.StatusOK), w.Body.String())
			Expect(resp.Seed).ToNot(BeNil())
			Expect(resp.Songs).ToNot(BeEmpty())
		},
		Entry("a song on two iPods", "a1"),
		Entry("a song on one iPod", "b3"),
		Entry("a song only in the combined library", "m1"),
		Entry("a placeholder song", "t5"),
	)

	It("reports how long each step took, for the browser's Network tab", func() {
		w, _ := radio("songId=a1")
		Expect(w.Code).To(Equal(http.StatusOK))
		Expect(w.Header().Get("Server-Timing")).To(MatchRegexp(
			`^data;dur=[\d.]+, seed;dur=[\d.]+, picks;dur=[\d.]+, songs;dur=[\d.]+$`))
	})

	It("plays a mix from a stand-in when neither the song nor its artist is on an iPod", func() {
		w, resp := radio("songId=x1")
		Expect(w.Code).To(Equal(http.StatusOK), w.Body.String())
		Expect(resp.Seed.ID).To(Equal("x1"))
		Expect(resp.SeedFallback).To(BeTrue())
		Expect(resp.RadioSeedID).ToNot(Equal("x1"))
		Expect(resp.Songs).ToNot(BeEmpty())
	})

	It("returns songs that carry the name of their iPod", func() {
		_, resp := radio("songId=a1")
		Expect(resp.Seed.LibraryName).To(Equal("iPod A"))
		Expect(resp.Songs).To(HaveEach(HaveField("LibraryName", Not(BeEmpty()))))
	})

	It("asks for more songs with the seed itself when it was found", func() {
		_, resp := radio("songId=a1")
		Expect(resp.SeedFallback).To(BeFalse())
		Expect(resp.RadioSeedID).To(Equal("a1"))
	})

	It("plays a surprise radio without a seed", func() {
		w, resp := radio("")
		Expect(w.Code).To(Equal(http.StatusOK), w.Body.String())
		Expect(resp.Songs).ToNot(BeEmpty())
	})

	It("never queues songs already played in the session", func() {
		// Skipped songs are part of the session too, so they are also excluded
		w, resp := radio("songId=a1&count=10&exclude=a2&exclude=bx0&skipped=bx0")
		Expect(w.Code).To(Equal(http.StatusOK), w.Body.String())
		Expect(resp.Songs).ToNot(BeEmpty())
		for _, s := range resp.Songs {
			Expect(s.Title).ToNot(BeElementOf("Song 2", "Filler 0"), "a song of the session was queued again")
		}
	})

	It("accepts drift seeds", func() {
		w, resp := radio("songId=a1&drift=a3&liked=a3")
		Expect(w.Code).To(Equal(http.StatusOK), w.Body.String())
		Expect(resp.Songs).ToNot(BeEmpty())
	})

	Describe("renaming tribes", func() {
		rename := func(c context.Context, body string) *httptest.ResponseRecorder {
			r := httptest.NewRequest(http.MethodPut, "/ipods/tribes/name", strings.NewReader(body)).WithContext(c)
			w := httptest.NewRecorder()
			adminOnlyMiddleware(http.HandlerFunc(api.renameIpodTribe)).ServeHTTP(w, r)
			return w
		}

		It("stores and removes an admin's name for a tribe, renaming it in the cache", func() {
			tribes := []ipodTribe{{ID: 0, Name: "2000s Alternative", autoName: "2000s Alternative", Ipods: []int{2, 3}}}
			ipodDataCache.entries["test"] = &ipodCacheEntry{data: &ipodData{
				tribes: ipodTribes{tribes: tribes}, network: ipodNetwork{Tribes: tribes},
			}}
			DeferCleanup(func() { delete(ipodDataCache.entries, "test") })
			cached := func() *ipodData { return ipodDataCache.entries["test"].data }

			Expect(rename(ctx, `{"name": " The Sad Kids ", "ipods": [2, 3]}`).Code).To(Equal(http.StatusNoContent))
			Expect(api.tribeOverrides(ctx)).To(Equal([]tribeOverride{{Name: "The Sad Kids", Ipods: []int{2, 3}}}))
			Expect(cached().tribes.tribes[0].Name).To(Equal("The Sad Kids"))
			Expect(cached().tribes.tribes[0].Custom).To(BeTrue())
			Expect(cached().network.Tribes[0].Name).To(Equal("The Sad Kids"))
			Expect(tribes[0].Name).To(Equal("2000s Alternative"), "data being read is not changed")

			Expect(rename(ctx, `{"name": "", "ipods": [2, 3]}`).Code).To(Equal(http.StatusNoContent))
			Expect(api.tribeOverrides(ctx)).To(BeEmpty())
			Expect(cached().tribes.tribes[0].Name).To(Equal("2000s Alternative"))
		})

		It("rejects bad requests and non-admins", func() {
			Expect(rename(ctx, `{"name": "x", "ipods": []}`).Code).To(Equal(http.StatusBadRequest))
			user := request.WithUser(context.Background(), model.User{ID: "u", UserName: "u"})
			Expect(rename(user, `{"name": "x", "ipods": [2]}`).Code).To(Equal(http.StatusForbidden))
		})
	})

	Describe("tour version", func() {
		get := func(c context.Context) int {
			r := httptest.NewRequest(http.MethodGet, "/ipods/tour", nil).WithContext(c)
			w := httptest.NewRecorder()
			api.getTourVersion(w, r)
			Expect(w.Code).To(Equal(http.StatusOK))
			var v tourVersion
			Expect(json.Unmarshal(w.Body.Bytes(), &v)).To(Succeed())
			return v.Version
		}
		put := func(c context.Context, body string) int {
			r := httptest.NewRequest(http.MethodPut, "/ipods/tour", strings.NewReader(body)).WithContext(c)
			w := httptest.NewRecorder()
			api.putTourVersion(w, r)
			return w.Code
		}

		It("remembers the last tour version each user saw", func() {
			other := request.WithUser(context.Background(), model.User{ID: "other-user", UserName: "other"})
			Expect(get(ctx)).To(Equal(0))
			Expect(put(ctx, `{"version": 2}`)).To(Equal(http.StatusOK))
			Expect(get(ctx)).To(Equal(2))
			Expect(get(other)).To(Equal(0))
		})

		It("rejects bad versions", func() {
			Expect(put(ctx, `{"version": -1}`)).To(Equal(http.StatusBadRequest))
			Expect(put(ctx, `nope`)).To(Equal(http.StatusBadRequest))
		})

		seen := func(c context.Context) []string {
			r := httptest.NewRequest(http.MethodGet, "/ipods/tour", nil).WithContext(c)
			w := httptest.NewRecorder()
			api.getTourVersion(w, r)
			var v tourVersion
			Expect(json.Unmarshal(w.Body.Bytes(), &v)).To(Succeed())
			return v.Seen
		}

		It("remembers the steps each user saw, adding new ones to them", func() {
			u := model.User{ID: "tour-seen", UserName: "tour-seen", NewPassword: "x"}
			Expect(ds.User(ctx).Put(&u)).To(Succeed())
			user := request.WithUser(context.Background(), u)
			Expect(seen(user)).To(BeEmpty())
			Expect(put(user, `{"seen": ["welcome", "search"]}`)).To(Equal(http.StatusOK))
			Expect(put(user, `{"seen": ["replay", "search"]}`)).To(Equal(http.StatusOK))
			Expect(seen(user)).To(Equal([]string{"replay", "search", "welcome"}))
			// Saving steps leaves the old version alone, and the other way round
			Expect(put(user, `{"version": 3}`)).To(Equal(http.StatusOK))
			Expect(get(user)).To(Equal(3))
			Expect(seen(user)).To(Equal([]string{"replay", "search", "welcome"}))
		})

		It("rejects step names that aren't plain words", func() {
			u := model.User{ID: "tour-bad", UserName: "tour-bad", NewPassword: "x"}
			Expect(ds.User(ctx).Put(&u)).To(Succeed())
			user := request.WithUser(context.Background(), u)
			Expect(put(user, `{"seen": ["a,b"]}`)).To(Equal(http.StatusBadRequest))
			Expect(put(user, `{"seen": [""]}`)).To(Equal(http.StatusBadRequest))
			Expect(seen(user)).To(BeEmpty())
		})
	})

	Describe("radio history", func() {
		call := func(method, query, body string) []radioHistoryEntry {
			r := httptest.NewRequest(method, "/ipods/radio/history"+query, strings.NewReader(body)).WithContext(ctx)
			w := httptest.NewRecorder()
			switch method {
			case http.MethodGet:
				api.getRadioHistory(w, r)
			case http.MethodPost:
				api.addRadioHistory(w, r)
			case http.MethodDelete:
				api.deleteRadioHistory(w, r)
			}
			Expect(w.Code).To(Equal(http.StatusOK), w.Body.String())
			var history []radioHistoryEntry
			Expect(json.Unmarshal(w.Body.Bytes(), &history)).To(Succeed())
			return history
		}
		seeds := func(history []radioHistoryEntry) []string {
			ids := make([]string, len(history))
			for i, e := range history {
				ids[i] = e.SeedID
			}
			return ids
		}

		BeforeEach(func() { call(http.MethodDelete, "", "") })

		It("records radios, most recent first, moving a restarted one to the top", func() {
			call(http.MethodPost, "", `{"seedId": "a1", "title": "Buddy Holly", "artist": "Weezer", "adventure": 0.5}`)
			call(http.MethodPost, "", `{"seedId": "b3", "title": "Only On B"}`)
			history := call(http.MethodPost, "", `{"seedId": "a1", "title": "Buddy Holly"}`)
			Expect(seeds(history)).To(Equal([]string{"a1", "b3"}))
			Expect(history[0].StartedAt).ToNot(BeZero())

			Expect(seeds(call(http.MethodGet, "", ""))).To(Equal([]string{"a1", "b3"}))
		})

		It("keeps only the last 50 radios", func() {
			history := []radioHistoryEntry{}
			for i := range radioHistoryMax + 5 {
				history = addToRadioHistory(history, radioHistoryEntry{SeedID: fmt.Sprint("s", i)})
			}
			Expect(history).To(HaveLen(radioHistoryMax))
			Expect(history[0].SeedID).To(Equal(fmt.Sprint("s", radioHistoryMax+4)))
		})

		It("removes one radio, or all of them", func() {
			call(http.MethodPost, "", `{"seedId": "a1"}`)
			call(http.MethodPost, "", `{"seedId": "b3"}`)
			Expect(seeds(call(http.MethodDelete, "?seedId=a1", ""))).To(Equal([]string{"b3"}))
			Expect(call(http.MethodDelete, "", "")).To(BeEmpty())
		})
	})
})
