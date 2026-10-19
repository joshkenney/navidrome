package scanner_test

import (
	"context"
	"net/url"
	"path/filepath"
	"strings"
	"testing/fstest"

	"github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/configtest"
	"github.com/navidrome/navidrome/core"
	"github.com/navidrome/navidrome/core/artwork"
	"github.com/navidrome/navidrome/core/metrics"
	"github.com/navidrome/navidrome/core/playlists"
	"github.com/navidrome/navidrome/core/storage"
	"github.com/navidrome/navidrome/core/storage/storagetest"
	"github.com/navidrome/navidrome/db"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/persistence"
	"github.com/navidrome/navidrome/scanner"
	"github.com/navidrome/navidrome/server/events"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

// fakeStorage serves a FakeFS for a library path
type fakeStorage struct{ fs *storagetest.FakeFS }

func (s fakeStorage) FS() (storage.MusicFS, error) { return s.fs, nil }

var _ = Describe("Scanner - Nested libraries", Ordered, func() {
	var ctx context.Context
	var ds *tests.MockDataStore
	var s model.Scanner
	var musicLib model.Library

	BeforeAll(func() {
		ctx = request.WithUser(GinkgoT().Context(), model.User{ID: "123", IsAdmin: true})
		tmpDir := GinkgoT().TempDir()
		conf.Server.DbPath = filepath.Join(tmpDir, "test-scanner-nested.db?_journal_mode=WAL")
		db.Db().SetMaxOpenConns(1)
	})

	BeforeEach(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.MusicFolder = "default:///music"
		conf.Server.DevExternalScanner = false

		emptyFS := storagetest.FakeFS{}
		emptyFS.SetFiles(fstest.MapFS{})
		storagetest.Register("default", &emptyFS)

		// "Music Library" holds the iPod's folder, and the iPod is also its own library
		song := template(_t{"albumartist": "Weezer", "album": "Blue", "year": 1994})
		musicFS := storagetest.FakeFS{}
		musicFS.SetFiles(fstest.MapFS{
			"ipod-a/Weezer/Blue/01 - My Name Is Jonas.mp3": song(track(1, "My Name Is Jonas")),
		})
		ipodFS := storagetest.FakeFS{}
		ipodFS.SetFiles(fstest.MapFS{
			"Weezer/Blue/01 - My Name Is Jonas.mp3": song(track(1, "My Name Is Jonas")),
		})
		storage.Register("nested", func(u url.URL) storage.Storage {
			if strings.HasSuffix(u.Path, "/ipod-a") {
				return fakeStorage{fs: &ipodFS}
			}
			return fakeStorage{fs: &musicFS}
		})

		db.Init(ctx)
		DeferCleanup(func() { Expect(tests.ClearDB()).To(Succeed()) })

		ds = &tests.MockDataStore{RealDS: persistence.New(db.Db())}
		admin := model.User{ID: "123", UserName: "admin", Name: "Admin", IsAdmin: true, NewPassword: "password"}
		Expect(ds.User(ctx).Put(&admin)).To(Succeed())

		s = scanner.New(ctx, ds, artwork.NoopCacheWarmer(), events.NoopBroker(),
			playlists.NewPlaylists(ds, core.NewImageUploadService()), metrics.NewNoopInstance())

		musicLib = model.Library{Name: "All Music", Path: "nested:///music"}
		Expect(ds.Library(ctx).Put(&musicLib)).To(Succeed())
	})

	filesIn := func(lib model.Library) model.MediaFiles {
		files, err := ds.MediaFile(ctx).GetAll(model.QueryOptions{Filters: squirrel.Eq{"media_file.library_id": lib.ID}})
		Expect(err).ToNot(HaveOccurred())
		return files
	}

	It("imports the iPod's folder only into the iPod library", func() {
		ipod := model.Library{Name: "iPod A", Path: "nested:///music/ipod-a"}
		Expect(ds.Library(ctx).Put(&ipod)).To(Succeed())

		_, err := s.ScanAll(ctx, true)
		Expect(err).ToNot(HaveOccurred())

		Expect(filesIn(musicLib)).To(BeEmpty())
		Expect(filesIn(ipod)).To(HaveLen(1))
	})

	It("merges tracks imported before the iPod library existed, keeping their stars", func() {
		_, err := s.ScanAll(ctx, true)
		Expect(err).ToNot(HaveOccurred())
		before := filesIn(musicLib)
		Expect(before).To(HaveLen(1))
		Expect(ds.MediaFile(ctx).SetStar(true, before[0].ID)).To(Succeed())

		ipod := model.Library{Name: "iPod A", Path: "nested:///music/ipod-a"}
		Expect(ds.Library(ctx).Put(&ipod)).To(Succeed())
		_, err = s.ScanAll(ctx, false)
		Expect(err).ToNot(HaveOccurred())

		Expect(filesIn(musicLib)).To(BeEmpty())
		after := filesIn(ipod)
		Expect(after).To(HaveLen(1))
		Expect(after[0].Starred).To(BeTrue())
	})
})
