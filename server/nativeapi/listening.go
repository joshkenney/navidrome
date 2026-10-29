package nativeapi

import (
	"cmp"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/utils/cache"
	"github.com/navidrome/navidrome/utils/req"
)

const (
	dayLayout = "2006-01-02"
	// minGapDays is how many days without listening make a gap
	minGapDays = 3
	holesTTL   = 10 * time.Minute
	maxGaps    = 8
)

// holesCache keeps each user's holes for a while: they take a few seconds on a big server
var holesCache = cache.NewSimpleCache[string, *holesResponse]()

func (api *Router) addListeningRoutes(r chi.Router) {
	r.Route("/listening", func(r chi.Router) {
		r.Get("/timeline", api.getTimeline)
		r.Get("/holes", api.getHoles)
		r.Get("/users", api.getListeningUsers)
	})
	r.Get("/search", api.search)
}

// listeningGap is a stretch of days without listening. From and To are the first and last silent days
type listeningGap struct {
	From string `json:"from"`
	To   string `json:"to"`
	Days int    `json:"days"`
}

// findGaps returns the stretches of at least minDays days between listening days (which must be sorted),
// longest first
func findGaps(days []model.ListeningDay, minDays int) []listeningGap {
	var gaps []listeningGap
	for i := 1; i < len(days); i++ {
		prev, err1 := time.Parse(dayLayout, days[i-1].Date)
		next, err2 := time.Parse(dayLayout, days[i].Date)
		if err1 != nil || err2 != nil {
			continue
		}
		silent := daysBetween(prev, next) - 1
		if silent >= minDays {
			gaps = append(gaps, listeningGap{
				From: prev.AddDate(0, 0, 1).Format(dayLayout),
				To:   next.AddDate(0, 0, -1).Format(dayLayout),
				Days: silent,
			})
		}
	}
	slices.SortStableFunc(gaps, func(a, b listeningGap) int {
		return cmp.Or(b.Days-a.Days, strings.Compare(b.From, a.From))
	})
	return gaps
}

func daysBetween(a, b time.Time) int {
	return int(b.Sub(a).Hours()/24 + 0.5)
}

// localToday is today's date for a listener whose clock is tzOffset minutes ahead of UTC
func localToday(now time.Time, tzOffset int) time.Time {
	d, _ := time.Parse(dayLayout, now.UTC().Add(time.Duration(tzOffset)*time.Minute).Format(dayLayout))
	return d
}

// parseLocalDay returns the instant a listener's day starts. Days are YYYY-MM-DD; zero when empty or invalid
func parseLocalDay(s string, tzOffset int) time.Time {
	d, err := time.Parse(dayLayout, s)
	if err != nil {
		return time.Time{}
	}
	return d.Add(-time.Duration(tzOffset) * time.Minute)
}

type timelineUser struct {
	ID       string `json:"id"`
	UserName string `json:"username"`
	Name     string `json:"name"`
}

type timelineResponse struct {
	*model.Timeline
	User  timelineUser    `json:"user"`
	Plays []activityEntry `json:"plays"`
	Gaps  []listeningGap  `json:"gaps"`
}

func toActivityEntry(e model.ListenEntry) activityEntry {
	return activityEntry{
		UserID:         e.UserID,
		Username:       e.Username,
		SubmissionTime: e.SubmissionTime,
		ID:             e.MediaFile.ID,
		Title:          e.MediaFile.Title,
		Artist:         e.MediaFile.Artist,
		Album:          e.MediaFile.Album,
		AlbumID:        e.MediaFile.AlbumID,
		ArtistID:       e.MediaFile.ArtistID,
		AlbumArtistID:  e.MediaFile.AlbumArtistID,
		Duration:       e.MediaFile.Duration,
		UpdatedAt:      e.MediaFile.UpdatedAt,
		LibraryID:      e.MediaFile.LibraryID,
		LibraryName:    e.MediaFile.LibraryName,
	}
}

var errHiddenListening = errors.New("this listener doesn't share their activity")

// listeningUser returns whose listening to show: the current user, or another user sharing their activity
func (api *Router) listeningUser(r *http.Request, userID string) (*model.User, error) {
	me, _ := request.UserFrom(r.Context())
	if userID == "" || userID == me.ID {
		return &me, nil
	}
	user, err := api.ds.User(r.Context()).Get(userID)
	if err != nil {
		return nil, err
	}
	if !user.ShareActivity {
		return nil, errHiddenListening
	}
	return user, nil
}

// getTimeline returns a user's listening between two days (YYYY-MM-DD, both included), in the
// listener's time zone ("tz", minutes ahead of UTC). Without days it covers all the user's listening
func (api *Router) getTimeline(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p := req.Params(r)
	tz := p.IntOr("tz", 0)
	user, err := api.listeningUser(r, p.StringOr("user", ""))
	if errors.Is(err, errHiddenListening) || errors.Is(err, model.ErrNotFound) {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	if err != nil {
		log.Error(ctx, "Error loading listener", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	opts := model.TimelineOptions{
		From:     parseLocalDay(p.StringOr("from", ""), tz),
		TZOffset: tz,
		Offset:   max(p.IntOr("_start", 0), 0),
	}
	if to := parseLocalDay(p.StringOr("to", ""), tz); !to.IsZero() {
		opts.To = to.AddDate(0, 0, 1)
	}
	opts.Max = min(max(p.IntOr("_end", 50)-opts.Offset, 1), 500)
	// "artist" and "ipod" narrow the plays list to some artists and iPods
	opts.ArtistIDs, _ = p.Strings("artist")
	ipods, _ := p.Strings("ipod")
	for _, id := range ipods {
		if n, err := strconv.Atoi(id); err == nil {
			opts.LibraryIDs = append(opts.LibraryIDs, n)
		}
	}

	timeline, err := api.ds.Listening(ctx).Timeline(user.ID, opts)
	if err != nil {
		log.Error(ctx, "Error loading timeline", "user", user.UserName, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	resp := timelineResponse{
		Timeline: timeline,
		User:     timelineUser{ID: user.ID, UserName: user.UserName, Name: user.Name},
		Plays:    make([]activityEntry, len(timeline.Plays)),
		Gaps:     findGaps(timeline.Days, minGapDays),
	}
	for i, e := range timeline.Plays {
		resp.Plays[i] = toActivityEntry(e)
		resp.Plays[i].Username = user.UserName
	}
	if len(resp.Gaps) > maxGaps {
		resp.Gaps = resp.Gaps[:maxGaps]
	}
	writeJSON(ctx, w, resp)
}

type holesSummary struct {
	FirstPlay      string `json:"firstPlay,omitempty"`
	LastPlay       string `json:"lastPlay,omitempty"`
	ListeningDays  int    `json:"listeningDays"`
	SpanDays       int    `json:"spanDays"`
	DaysSinceLast  int    `json:"daysSinceLast"`
	ForgottenAfter int    `json:"forgottenAfterDays"`
}

type holesResponse struct {
	*model.Holes
	Gaps    []listeningGap `json:"gaps"`
	Summary holesSummary   `json:"summary"`
}

const forgottenAfterDays = 180

func buildHolesResponse(holes *model.Holes, today time.Time) *holesResponse {
	resp := &holesResponse{
		Holes:   holes,
		Gaps:    findGaps(holes.Days, minGapDays),
		Summary: holesSummary{ListeningDays: len(holes.Days), ForgottenAfter: forgottenAfterDays},
	}
	if len(resp.Gaps) > maxGaps {
		resp.Gaps = resp.Gaps[:maxGaps]
	}
	if len(holes.Days) > 0 {
		resp.Summary.FirstPlay = holes.Days[0].Date
		resp.Summary.LastPlay = holes.Days[len(holes.Days)-1].Date
		if first, err := time.Parse(dayLayout, resp.Summary.FirstPlay); err == nil {
			resp.Summary.SpanDays = daysBetween(first, today) + 1
		}
		if last, err := time.Parse(dayLayout, resp.Summary.LastPlay); err == nil {
			resp.Summary.DaysSinceLast = max(daysBetween(last, today), 0)
		}
	}
	return resp
}

// getHoles returns what the current user hasn't explored or has stopped listening to
func (api *Router) getHoles(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p := req.Params(r)
	tz := p.IntOr("tz", 0)
	user, _ := request.UserFrom(ctx)
	key := user.ID + "|" + p.StringOr("tz", "0")
	load := func(string) (*holesResponse, time.Duration, error) {
		holes, err := api.ds.Listening(ctx).Holes(model.HolesOptions{
			ForgottenBefore: time.Now().AddDate(0, 0, -forgottenAfterDays),
			TZOffset:        tz,
			Max:             24,
		})
		if err != nil {
			return nil, 0, err
		}
		return buildHolesResponse(holes, localToday(time.Now(), tz)), holesTTL, nil
	}
	var resp *holesResponse
	var err error
	if p.BoolOr("refresh", false) {
		if resp, _, err = load(key); err == nil {
			_ = holesCache.AddWithTTL(key, resp, holesTTL)
		}
	} else {
		resp, err = holesCache.GetWithLoader(key, load)
	}
	if err != nil || resp == nil {
		log.Error(ctx, "Error finding listening holes", "user", user.UserName, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, resp)
}

// getListeningUsers returns the listeners whose timeline the current user can see
func (api *Router) getListeningUsers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	users, err := api.ds.Listening(ctx).SearchUsers("", 100)
	if err != nil {
		log.Error(ctx, "Error loading listeners", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if users == nil {
		users = []model.ListeningUser{}
	}
	writeJSON(ctx, w, users)
}
