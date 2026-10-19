package nativeapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"

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
		ipodDataCache.entries = map[string]*ipodData{}

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

	It("plays a mix from a stand-in when neither the song nor its artist is on an iPod", func() {
		w, resp := radio("songId=x1")
		Expect(w.Code).To(Equal(http.StatusOK), w.Body.String())
		Expect(resp.Seed.ID).To(Equal("x1"))
		Expect(resp.SeedFallback).To(BeTrue())
		Expect(resp.RadioSeedID).ToNot(Equal("x1"))
		Expect(resp.Songs).ToNot(BeEmpty())
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
})
