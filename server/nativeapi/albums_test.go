package nativeapi

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/configtest"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/core"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Album cover endpoints", func() {
	var (
		api    *Router
		albums *tests.MockAlbumRepo
		props  *tests.MockedPropertyRepo
	)

	BeforeEach(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.DataFolder = GinkgoT().TempDir()
		albums = tests.CreateMockAlbumRepo()
		albums.SetData(model.Albums{{ID: "al-1", Name: "Weezer"}})
		props = &tests.MockedPropertyRepo{}
		ds := &tests.MockDataStore{MockedAlbum: albums, MockedProperty: props}
		api = &Router{ds: ds, imgUpload: core.NewImageUploadService()}
	})

	serve := func(handler http.Handler, method string, isAdmin bool, body *bytes.Buffer, contentType string) int {
		if body == nil {
			body = &bytes.Buffer{}
		}
		req := httptest.NewRequest(method, "/album/al-1/image", body)
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
		rctx := chi.NewRouteContext()
		rctx.URLParams.Add("id", "al-1")
		ctx := context.WithValue(GinkgoT().Context(), chi.RouteCtxKey, rctx)
		ctx = request.WithUser(ctx, model.User{ID: "user-1", IsAdmin: isAdmin})
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req.WithContext(ctx))
		return w.Code
	}

	upload := func(isAdmin bool) int {
		var img bytes.Buffer
		Expect(png.Encode(&img, image.NewRGBA(image.Rect(0, 0, 2, 2)))).To(Succeed())
		var body bytes.Buffer
		mw := multipart.NewWriter(&body)
		part, err := mw.CreateFormFile("image", "cover.png")
		Expect(err).ToNot(HaveOccurred())
		_, _ = part.Write(img.Bytes())
		Expect(mw.Close()).To(Succeed())
		return serve(api.uploadAlbumImage(), http.MethodPost, isAdmin, &body, mw.FormDataContentType())
	}

	saveFoundCover := func() string {
		path := model.UploadedImagePath(consts.EntityAlbum, model.AlbumCoverFilename("al-1", true, ".jpg"))
		Expect(os.MkdirAll(filepath.Dir(path), 0755)).To(Succeed())
		Expect(os.WriteFile(path, []byte("found"), 0600)).To(Succeed())
		return path
	}

	DescribeTable("lets only admins set covers, even when users can upload other images",
		func(enableArtworkUpload bool) {
			conf.Server.EnableArtworkUpload = enableArtworkUpload
			Expect(upload(false)).To(Equal(http.StatusForbidden))
			Expect(serve(api.deleteAlbumImage(), http.MethodDelete, false, nil, "")).To(Equal(http.StatusForbidden))
			Expect(model.AlbumCoverKind("al-1")).To(BeEmpty())
		},
		Entry("uploads enabled", true),
		Entry("uploads disabled", false),
	)

	It("saves an uploaded cover and marks the album as updated", func() {
		Expect(upload(true)).To(Equal(http.StatusOK))
		Expect(model.AlbumCoverPath("al-1", false)).To(HaveSuffix("al-1.png"))
		Expect(model.AlbumCoverKind("al-1")).To(Equal("manual"))
		Expect(albums.Data["al-1"].UpdatedAt.IsZero()).To(BeFalse())
	})

	It("removes an uploaded cover, keeping a found one", func() {
		found := saveFoundCover()
		Expect(upload(true)).To(Equal(http.StatusOK))
		Expect(serve(api.deleteAlbumImage(), http.MethodDelete, true, nil, "")).To(Equal(http.StatusOK))
		Expect(model.AlbumCoverKind("al-1")).To(Equal("auto"))
		Expect(found).To(BeAnExistingFile())
	})

	It("removes a found cover and keeps the finder from adding it again", func() {
		found := saveFoundCover()
		Expect(serve(api.deleteAlbumImage(), http.MethodDelete, true, nil, "")).To(Equal(http.StatusOK))
		Expect(found).ToNot(BeAnExistingFile())
		var misses map[string]any
		Expect(json.Unmarshal([]byte(props.Data["CoverFinderMisses"]), &misses)).To(Succeed())
		Expect(misses).To(HaveKey("al-1"))
	})

	It("returns 404 for an unknown album", func() {
		albums.SetData(nil)
		Expect(upload(true)).To(Equal(http.StatusNotFound))
	})
})
