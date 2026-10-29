package nativeapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"time"

	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

// fakeListeningRepo records the timeline asked for
type fakeListeningRepo struct {
	model.ListeningRepository
	userID string
	opts   model.TimelineOptions
}

func (r *fakeListeningRepo) Timeline(userID string, opts model.TimelineOptions) (*model.Timeline, error) {
	r.userID, r.opts = userID, opts
	return &model.Timeline{Days: []model.ListeningDay{{Date: "2026-06-01"}, {Date: "2026-06-10"}}}, nil
}

var _ = Describe("Listening", func() {
	days := func(dates ...string) []model.ListeningDay {
		res := make([]model.ListeningDay, len(dates))
		for i, d := range dates {
			res[i] = model.ListeningDay{Date: d, Plays: 1}
		}
		return res
	}

	Describe("findGaps", func() {
		It("finds the stretches without listening, longest first", func() {
			gaps := findGaps(days("2026-01-01", "2026-01-02", "2026-01-06", "2026-01-30", "2026-02-01"), 3)
			Expect(gaps).To(Equal([]listeningGap{
				{From: "2026-01-07", To: "2026-01-29", Days: 23},
				{From: "2026-01-03", To: "2026-01-05", Days: 3},
			}))
		})

		It("crosses daylight saving changes", func() {
			Expect(findGaps(days("2026-03-01", "2026-04-01"), 3)).To(Equal([]listeningGap{
				{From: "2026-03-02", To: "2026-03-31", Days: 30},
			}))
		})

		It("is empty without enough days", func() {
			Expect(findGaps(days("2026-01-01"), 3)).To(BeEmpty())
			Expect(findGaps(nil, 3)).To(BeEmpty())
		})
	})

	Describe("parseLocalDay", func() {
		It("returns when the listener's day starts", func() {
			Expect(parseLocalDay("2026-06-01", -240)).To(Equal(time.Date(2026, 6, 1, 4, 0, 0, 0, time.UTC)))
			Expect(parseLocalDay("", 0)).To(BeZero())
			Expect(parseLocalDay("june", 0)).To(BeZero())
		})
	})

	Describe("localToday", func() {
		It("follows the listener's clock", func() {
			now := time.Date(2026, 6, 1, 23, 30, 0, 0, time.UTC)
			Expect(localToday(now, 60).Format(dayLayout)).To(Equal("2026-06-02"))
			Expect(localToday(now, -60).Format(dayLayout)).To(Equal("2026-06-01"))
		})
	})

	Describe("buildHolesResponse", func() {
		It("sums up the listening", func() {
			holes := &model.Holes{Days: days("2026-01-01", "2026-01-10", "2026-01-11")}
			today, _ := time.Parse(dayLayout, "2026-01-20")
			resp := buildHolesResponse(holes, today)
			Expect(resp.Summary.FirstPlay).To(Equal("2026-01-01"))
			Expect(resp.Summary.LastPlay).To(Equal("2026-01-11"))
			Expect(resp.Summary.ListeningDays).To(Equal(3))
			Expect(resp.Summary.SpanDays).To(Equal(20))
			Expect(resp.Summary.DaysSinceLast).To(Equal(9))
			Expect(resp.Gaps).To(HaveLen(1))
		})

		It("works for someone who never listened", func() {
			resp := buildHolesResponse(&model.Holes{}, time.Now())
			Expect(resp.Summary.ListeningDays).To(BeZero())
			Expect(resp.Gaps).To(BeEmpty())
		})
	})

	Describe("getTimeline", func() {
		var api *Router
		var repo *fakeListeningRepo
		me := model.User{ID: "me", UserName: "me"}
		friend := model.User{ID: "friend", UserName: "friend", ShareActivity: true}
		shy := model.User{ID: "shy", UserName: "shy"}

		BeforeEach(func() {
			repo = &fakeListeningRepo{}
			users := tests.CreateMockUserRepo()
			Expect(users.Put(&friend)).To(Succeed())
			Expect(users.Put(&shy)).To(Succeed())
			api = &Router{ds: &tests.MockDataStore{MockedListening: repo, MockedUser: users}}
		})

		get := func(url string) *httptest.ResponseRecorder {
			r := httptest.NewRequest("GET", url, nil)
			r = r.WithContext(request.WithUser(context.Background(), me))
			w := httptest.NewRecorder()
			api.getTimeline(w, r)
			return w
		}

		It("returns my listening between two days in my time zone", func() {
			w := get("/listening/timeline?from=2026-06-01&to=2026-06-30&tz=-240")
			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(repo.userID).To(Equal("me"))
			Expect(repo.opts.From).To(Equal(time.Date(2026, 6, 1, 4, 0, 0, 0, time.UTC)))
			Expect(repo.opts.To).To(Equal(time.Date(2026, 7, 1, 4, 0, 0, 0, time.UTC)))
			var resp map[string]any
			Expect(json.Unmarshal(w.Body.Bytes(), &resp)).To(Succeed())
			Expect(resp["gaps"]).To(HaveLen(1))
			Expect(resp["user"]).To(HaveKeyWithValue("username", "me"))
		})

		It("shows a listener who shares their activity", func() {
			Expect(get("/listening/timeline?user=friend").Code).To(Equal(http.StatusOK))
			Expect(repo.userID).To(Equal("friend"))
		})

		It("hides a listener who doesn't", func() {
			Expect(get("/listening/timeline?user=shy").Code).To(Equal(http.StatusForbidden))
			Expect(repo.userID).To(BeEmpty())
		})
	})
})

var _ = Describe("Search", func() {
	Describe("extraMatch", func() {
		tags := model.Tags{model.TagRecordLabel: {"Warp Records"}}

		It("is empty when the name matches", func() {
			Expect(extraMatch("warp", []string{"Warp Speed"}, "", "", tags)).To(BeEmpty())
		})

		It("tells where else the query was found", func() {
			Expect(extraMatch("warp", []string{"Windowlicker"}, "", "", tags)).To(Equal("label"))
			Expect(extraMatch("demo", []string{"Song"}, "An early demo", "", nil)).To(Equal("comment"))
			Expect(extraMatch("ocean", []string{"Song"}, "", `[{"line":[{"value":"by the ocean"}]}]`, nil)).To(Equal("lyrics"))
		})
	})

	Describe("newSearchGroup", func() {
		It("tells when there are more results", func() {
			Expect(newSearchGroup([]int{1, 2, 3}, 2)).To(Equal(&searchGroup[int]{Items: []int{1, 2}, More: true}))
			Expect(newSearchGroup([]int{1, 2}, 2)).To(Equal(&searchGroup[int]{Items: []int{1, 2}}))
			Expect(newSearchGroup[int](nil, 2).Items).To(Equal([]int{}))
		})
	})
})
