package nativeapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"

	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

// fakeErasRepo records the songs asked for
type fakeErasRepo struct {
	model.ErasRepository
	opts model.EraSongsOptions
}

func (r *fakeErasRepo) EraSongs(opts model.EraSongsOptions) (model.MediaFiles, error) {
	r.opts = opts
	return model.MediaFiles{{ID: "s1", Lyrics: "la la la"}}, nil
}

var _ = Describe("Eras", func() {
	var api *Router
	var repo *fakeErasRepo

	BeforeEach(func() {
		repo = &fakeErasRepo{}
		api = &Router{ds: &tests.MockDataStore{MockedEras: repo}}
	})

	get := func(url string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", url, nil)
		r = r.WithContext(request.WithUser(context.Background(), model.User{ID: "me"}))
		w := httptest.NewRecorder()
		api.getEraSongs(w, r)
		return w
	}

	It("picks songs of an era to play", func() {
		w := get("/eras/play?from=1970&to=1979&mode=journey&count=30&genre=Funk&unplayed=true&library_id=2")
		Expect(w.Code).To(Equal(http.StatusOK))
		Expect(repo.opts).To(Equal(model.EraSongsOptions{
			From: 1970, To: 1979, Max: 30, Journey: true, Genre: "Funk", Unplayed: true, LibraryIDs: []int{2},
		}))
		var songs []map[string]any
		Expect(json.Unmarshal(w.Body.Bytes(), &songs)).To(Succeed())
		Expect(songs[0]["lyrics"]).To(BeEmpty())
	})

	It("plays a single year, shuffled", func() {
		Expect(get("/eras/play?from=1977").Code).To(Equal(http.StatusOK))
		Expect(repo.opts.From).To(Equal(1977))
		Expect(repo.opts.To).To(Equal(1977))
		Expect(repo.opts.Journey).To(BeFalse())
		Expect(repo.opts.Max).To(Equal(eraSongsDefault))
	})

	It("needs years", func() {
		Expect(get("/eras/play").Code).To(Equal(http.StatusBadRequest))
		Expect(get("/eras/play?from=1980&to=1970").Code).To(Equal(http.StatusBadRequest))
	})
})
