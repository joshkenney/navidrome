package nativeapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"

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

var _ = Describe("iPod folder size", Ordered, func() {
	var ctx context.Context
	var api *Router
	var ds model.DataStore
	var folder string
	var lib model.Library

	write := func(path string, size int) {
		Expect(os.MkdirAll(filepath.Dir(path), 0o755)).To(Succeed())
		Expect(os.WriteFile(path, make([]byte, size), 0o600)).To(Succeed())
	}

	BeforeAll(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.DbPath = filepath.Join(GinkgoT().TempDir(), "size.db?_journal_mode=WAL")
		admin := model.User{ID: "size-admin", UserName: "size-admin", IsAdmin: true, NewPassword: "x"}
		ctx = request.WithUser(context.Background(), admin)
		db.Init(ctx)
		DeferCleanup(func() { Expect(tests.ClearDB()).To(Succeed()) })
		ds = persistence.New(db.Db())
		Expect(ds.User(ctx).Put(&admin)).To(Succeed())
		api = &Router{ds: ds}

		// The iPod's folder: songs, and everything else on it
		folder = GinkgoT().TempDir()
		write(filepath.Join(folder, "iPod_Control", "Music", "F00", "a.mp3"), 3000)
		write(filepath.Join(folder, "iPod_Control", "Music", "F01", "b.m4a"), 2000)
		write(filepath.Join(folder, "Notes", "todo.txt"), 500)
		lib = model.Library{Name: "Josh's iPod", Path: folder}
		Expect(ds.Library(ctx).Put(&lib)).To(Succeed())
	})

	get := func(userCtx context.Context, id int) (*httptest.ResponseRecorder, ipodSizeResponse) {
		r := httptest.NewRequest("GET", "/ipods/"+strconv.Itoa(id)+"/size", nil)
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", strconv.Itoa(id))
		r = r.WithContext(context.WithValue(userCtx, chi.RouteCtxKey, rctx))
		w := httptest.NewRecorder()
		api.getIpodSize(w, r)
		var resp ipodSizeResponse
		if w.Code == http.StatusOK {
			Expect(json.Unmarshal(w.Body.Bytes(), &resp)).To(Succeed())
		}
		return w, resp
	}

	It("adds up every file in the folder", func() {
		Expect(folderSize(folder)).To(Equal(int64(5500)))
	})

	It("measures the folder in the background, then keeps its size", func() {
		_, first := get(ctx, lib.ID)
		Expect(first.Measuring).To(BeTrue())
		Expect(first.Size).To(BeNil())

		var later ipodSizeResponse
		Eventually(func() *int64 {
			_, later = get(ctx, lib.ID)
			return later.Size
		}).ShouldNot(BeNil())
		Expect(*later.Size).To(Equal(int64(5500)))
		Expect(later.Measuring).To(BeFalse())
	})

	It("measures it again once the iPod has been scanned since", func() {
		write(filepath.Join(folder, "iPod_Control", "Music", "F02", "c.mp3"), 1000)
		Expect(ds.Library(ctx).ScanBegin(lib.ID, false)).To(Succeed())
		Expect(ds.Library(ctx).ScanEnd(lib.ID)).To(Succeed())
		_, stale := get(ctx, lib.ID)
		Expect(stale.Measuring).To(BeTrue())
		Expect(*stale.Size).To(Equal(int64(5500)))
	})

	It("is only for the users of the iPod", func() {
		other := request.WithUser(context.Background(), model.User{ID: "someone", UserName: "someone"})
		w, _ := get(other, lib.ID)
		Expect(w.Code).To(Equal(http.StatusNotFound))
	})
})
