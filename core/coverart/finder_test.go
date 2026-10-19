package coverart

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"time"

	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/configtest"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

// fakeFolders serves folders for the album lookups
type fakeFolders struct {
	model.FolderRepository
	folders []model.Folder
}

func (f fakeFolders) GetAll(...model.QueryOptions) ([]model.Folder, error) { return f.folders, nil }

type iTunesResult struct {
	CollectionName string `json:"collectionName"`
	ArtistName     string `json:"artistName"`
	ArtworkURL100  string `json:"artworkUrl100"`
	ReleaseDate    string `json:"releaseDate"`
}

type deezerResult struct {
	Title   string `json:"title"`
	CoverXL string `json:"cover_xl"`
	Artist  struct {
		Name string `json:"name"`
	} `json:"artist"`
}

var _ = Describe("Finder", func() {
	var (
		ctx        context.Context
		ds         *tests.MockDataStore
		albums     *tests.MockAlbumRepo
		props      *tests.MockedPropertyRepo
		finder     *Finder
		server     *httptest.Server
		itunes     []iTunesResult
		deezer     []deezerResult
		itunesDown bool
		deezerDown bool
		searches   []string
	)

	pngBytes := func() []byte {
		var buf bytes.Buffer
		Expect(png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 2, 2)))).To(Succeed())
		return buf.Bytes()
	}()

	BeforeEach(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.DataFolder = GinkgoT().TempDir()
		conf.Server.LastFM.ApiKey = ""
		ctx = GinkgoT().Context()
		itunes, deezer, searches = nil, nil, nil
		itunesDown, deezerDown = false, false

		server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/itunes":
				searches = append(searches, "itunes:"+r.URL.Query().Get("term"))
				if itunesDown {
					w.WriteHeader(http.StatusServiceUnavailable)
					return
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"results": itunes})
			case "/deezer":
				searches = append(searches, "deezer:"+r.URL.Query().Get("q"))
				if deezerDown {
					w.WriteHeader(http.StatusServiceUnavailable)
					return
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"data": deezer})
			case "/img/100x100bb.jpg", "/img/600x600bb.jpg", "/img/xl.jpg":
				_, _ = w.Write(pngBytes)
			default:
				w.WriteHeader(http.StatusNotFound)
			}
		}))
		DeferCleanup(server.Close)

		albums = tests.CreateMockAlbumRepo()
		props = &tests.MockedPropertyRepo{}
		ds = &tests.MockDataStore{MockedAlbum: albums, MockedProperty: props,
			MockedFolder: fakeFolders{}}
		finder = NewFinder(ds, nil)
		finder.ITunesURL = server.URL + "/itunes"
		finder.DeezerURL = server.URL + "/deezer"
		finder.AllowedHosts = []string{"127.0.0.1"}
		finder.Delay = 0
	})

	img := func(name string) string { return server.URL + "/img/" + name }
	weezer := model.Album{ID: "al-1", Name: "Weezer (Deluxe Edition)", AlbumArtist: "Weezer"}

	Describe("matches", func() {
		It("matches the same artist and title, ignoring editions, case and punctuation", func() {
			Expect(matches(weezer, "weezer", "Weezer", 0)).To(BeTrue())
			Expect(matches(model.Album{Name: "Pinkerton", AlbumArtist: "Weezer"}, "Weezer", "Pinkerton - EP", 0)).To(BeTrue())
			Expect(matches(model.Album{Name: "Panic! At The Disco", AlbumArtist: "The Killers"}, "Killers", "panic at the disco", 0)).To(BeTrue())
		})

		It("rejects another artist or another album", func() {
			Expect(matches(weezer, "Rivers Cuomo", "Weezer", 0)).To(BeFalse())
			Expect(matches(weezer, "Weezer", "Pinkerton", 0)).To(BeFalse())
		})

		It("matches compilations by title and year", func() {
			now := model.Album{Name: "Now 5", AlbumArtist: "Various Artists", Compilation: true, MinYear: 2000, MaxYear: 2000}
			Expect(matches(now, "Various Artists", "Now 5", 2000)).To(BeTrue())
			Expect(matches(now, "Various Artists", "Now 5", 2012)).To(BeFalse())
		})

		It("never matches albums without a real title", func() {
			unknown := model.Album{Name: "[Unknown Album]", AlbumArtist: "Weezer"}
			Expect(matches(unknown, "Weezer", "[Unknown Album]", 0)).To(BeFalse())
		})
	})

	Describe("FindAlbum", func() {
		It("saves the iTunes cover at 600x600", func() {
			itunes = []iTunesResult{
				{CollectionName: "Pinkerton", ArtistName: "Weezer", ArtworkURL100: img("100x100bb.jpg")},
				{CollectionName: "Weezer", ArtistName: "Weezer", ArtworkURL100: img("100x100bb.jpg")},
			}
			found, err := finder.FindAlbum(ctx, weezer)
			Expect(err).ToNot(HaveOccurred())
			Expect(found).To(BeTrue())
			path := model.AlbumCoverPath("al-1", true)
			Expect(path).To(HaveSuffix("al-1.auto.png"))
			Expect(os.ReadFile(path)).To(Equal(pngBytes))
			Expect(model.AlbumCoverKind("al-1")).To(Equal("auto"))
			Expect(searches[0]).To(Equal("itunes:Weezer Weezer (Deluxe Edition)"))
		})

		It("falls back to Deezer when iTunes has no match", func() {
			itunes = []iTunesResult{{CollectionName: "Weezer", ArtistName: "Someone Else", ArtworkURL100: img("100x100bb.jpg")}}
			deezer = []deezerResult{{Title: "Weezer", CoverXL: img("xl.jpg")}}
			deezer[0].Artist.Name = "Weezer"
			found, err := finder.FindAlbum(ctx, weezer)
			Expect(err).ToNot(HaveOccurred())
			Expect(found).To(BeTrue())
			Expect(searches[1]).To(Equal(`deezer:artist:"Weezer" album:"Weezer (Deluxe Edition)"`))
		})

		It("reports a miss when nothing matches", func() {
			found, err := finder.FindAlbum(ctx, weezer)
			Expect(err).ToNot(HaveOccurred())
			Expect(found).To(BeFalse())
			Expect(model.AlbumCoverPath("al-1", true)).To(BeEmpty())
		})

		It("reports an error, not a miss, when no source could be searched", func() {
			itunesDown, deezerDown = true, true
			found, err := finder.FindAlbum(ctx, weezer)
			Expect(err).To(HaveOccurred())
			Expect(found).To(BeFalse())
		})

		It("only downloads from the sources' image hosts", func() {
			finder.AllowedHosts = []string{".mzstatic.com"}
			itunes = []iTunesResult{{CollectionName: "Weezer", ArtistName: "Weezer", ArtworkURL100: img("100x100bb.jpg")}}
			found, err := finder.FindAlbum(ctx, weezer)
			Expect(err).ToNot(HaveOccurred())
			Expect(found).To(BeFalse())
			Expect(model.AlbumCoverPath("al-1", true)).To(BeEmpty())
		})
	})

	Describe("Run", func() {
		BeforeEach(func() {
			conf.Server.CoverArtPriority = "cover.*, folder.*, embedded, external"
			ds.MockedFolder = fakeFolders{folders: []model.Folder{
				{ID: "f-has-cover", ImageFiles: []string{"Cover.JPG"}},
				{ID: "f-only-back", ImageFiles: []string{"back.jpg"}},
				{ID: "disc1", ParentID: "f-parent"},
				{ID: "disc2", ParentID: "f-parent"},
				{ID: "f-parent", ImageFiles: []string{"folder.png"}},
			}}
			albums.SetData(model.Albums{
				{ID: "al-1", Name: "Weezer", AlbumArtist: "Weezer", FolderIDs: []string{"f-only-back"}},
				{ID: "al-2", Name: "Pinkerton", AlbumArtist: "Weezer", FolderIDs: []string{"f-has-cover"}},
				{ID: "al-3", Name: "Maladroit", AlbumArtist: "Weezer", FolderIDs: []string{"disc1", "disc2"}},
				{ID: "al-4", Name: "[Unknown Album]", AlbumArtist: "Weezer"},
				{ID: "al-5", Name: "Make Believe", AlbumArtist: "Weezer"},
			})
			itunes = []iTunesResult{{CollectionName: "Weezer", ArtistName: "Weezer", ArtworkURL100: img("100x100bb.jpg")}}
		})

		It("looks up only albums without a cover, and remembers misses", func() {
			sum, err := finder.Run(ctx)
			Expect(err).ToNot(HaveOccurred())
			Expect(sum).To(Equal(Summary{Found: 1, Missed: 1, Skipped: 1}))
			Expect(model.AlbumCoverKind("al-1")).To(Equal("auto"))
			for _, s := range searches {
				Expect(s).ToNot(ContainSubstring("Pinkerton"))
				Expect(s).ToNot(ContainSubstring("Maladroit"))
			}
			var misses map[string]time.Time
			Expect(json.Unmarshal([]byte(props.Data[missesKey]), &misses)).To(Succeed())
			Expect(misses).To(HaveKey("al-5"))
		})

		It("skips albums missed less than 30 days ago, and retries them after", func() {
			_, _ = finder.Run(ctx)
			searches = nil
			sum, _ := finder.Run(ctx)
			Expect(sum.Missed).To(Equal(0))
			Expect(searches).To(BeEmpty())

			finder.now = func() time.Time { return time.Now().Add(31 * 24 * time.Hour) }
			sum, _ = finder.Run(ctx)
			Expect(sum.Missed).To(Equal(1))
		})

		It("lets an album be looked up again once its miss is forgotten", func() {
			_, _ = finder.Run(ctx)
			Expect(ForgetMiss(ctx, ds, "al-5")).To(Succeed())
			searches = nil
			_, _ = finder.Run(ctx)
			Expect(strings.Join(searches, ",")).To(ContainSubstring("Make Believe"))
		})

		It("does not count an outage as a miss", func() {
			itunesDown, deezerDown = true, true
			sum, err := finder.Run(ctx)
			Expect(err).ToNot(HaveOccurred())
			Expect(sum.Missed).To(Equal(0))
			Expect(props.Data[missesKey]).To(Equal("{}"))
		})

		It("stops while a scan is running", func() {
			finder.IsScanning = func() bool { return true }
			sum, _ := finder.Run(ctx)
			Expect(sum).To(Equal(Summary{}))
			Expect(searches).To(BeEmpty())
		})

		It("leaves albums that already have a cover in the data folder alone", func() {
			path := model.UploadedImagePath("album", model.AlbumCoverFilename("al-5", false, ".jpg"))
			Expect(os.MkdirAll(strings.TrimSuffix(path, "al-5.jpg"), 0755)).To(Succeed())
			Expect(os.WriteFile(path, pngBytes, 0600)).To(Succeed())
			_, _ = finder.Run(ctx)
			Expect(fmt.Sprint(searches)).ToNot(ContainSubstring("Make Believe"))
		})
	})
})
