package nativeapi

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/utils/cache"
	"github.com/navidrome/navidrome/utils/req"
)

const (
	erasTTL         = 10 * time.Minute
	eraListLimit    = 12
	eraSongsLimit   = 200
	eraSongsDefault = 60
)

// erasCache keeps each user's eras (years with their play counts) for a while
var erasCache = cache.NewSimpleCache[string, *model.Eras]()

func (api *Router) addErasRoutes(r chi.Router) {
	r.Route("/eras", func(r chi.Router) {
		r.Get("/", api.getEras)
		r.Get("/era", api.getEra)
		r.Get("/play", api.getEraSongs)
	})
}

// getEras returns how much music on the server comes from each year
func (api *Router) getEras(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, _ := request.UserFrom(ctx)
	eras, err := erasCache.GetWithLoader(user.ID, func(string) (*model.Eras, time.Duration, error) {
		eras, err := api.ds.Eras(ctx).Eras()
		return eras, erasTTL, err
	})
	if err != nil {
		log.Error(ctx, "Error loading eras", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, eras)
}

// eraRange reads the years asked for ("from" and "to", both included)
func eraRange(p *req.Values) (int, int, bool) {
	from, to := p.IntOr("from", 0), p.IntOr("to", 0)
	if to == 0 {
		to = from
	}
	return from, to, from > 0 && to >= from
}

// getEra describes the music released between two years: its artists, albums, genres and iPods
func (api *Router) getEra(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	from, to, ok := eraRange(req.Params(r))
	if !ok {
		http.Error(w, "from and to years are required", http.StatusBadRequest)
		return
	}
	era, err := api.ds.Eras(ctx).Era(from, to, eraListLimit)
	if err != nil {
		log.Error(ctx, "Error loading era", "from", from, "to", to, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	writeJSON(ctx, w, era)
}

// getEraSongs picks songs released between two years to play: shuffled ("mode=shuffle", the
// default) or in the order they came out ("mode=journey"). Optional: genre, library_id, unplayed
func (api *Router) getEraSongs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	p := req.Params(r)
	from, to, ok := eraRange(p)
	if !ok {
		http.Error(w, "from and to years are required", http.StatusBadRequest)
		return
	}
	libraryIDs, _ := p.Ints("library_id")
	songs, err := api.ds.Eras(ctx).EraSongs(model.EraSongsOptions{
		From:       from,
		To:         to,
		Max:        min(max(p.IntOr("count", eraSongsDefault), 1), eraSongsLimit),
		Journey:    p.StringOr("mode", "shuffle") == "journey",
		Genre:      p.StringOr("genre", ""),
		LibraryIDs: libraryIDs,
		Unplayed:   p.BoolOr("unplayed", false),
	})
	if err != nil {
		log.Error(ctx, "Error picking era songs", "from", from, "to", to, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	for i := range songs {
		songs[i].Lyrics = ""
	}
	if songs == nil {
		songs = model.MediaFiles{}
	}
	writeJSON(ctx, w, songs)
}
