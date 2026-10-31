package nativeapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
)

// The size on disk of each iPod's folder (its library's): every file in it, not only the songs,
// for Settings > About on the phone iPods. Walking a big folder takes a while, so it is measured
// in the background and kept in the database: measured again once the iPod has been scanned
// since, or after ipodSizeMaxAge

type ipodFolderSize struct {
	Size       int64     `json:"size"`
	MeasuredAt time.Time `json:"measuredAt"`
}

type ipodSizeResponse struct {
	ID         int        `json:"id"`
	Size       *int64     `json:"size,omitempty"`
	MeasuredAt *time.Time `json:"measuredAt,omitempty"`
	// Whether it is being measured: the size, if any, is an older one
	Measuring bool `json:"measuring"`
}

var ipodSizeMaxAge = 24 * time.Hour

// The iPods being measured, so each is walked once at a time
var ipodSizing = struct {
	sync.Mutex
	running map[int]bool
}{running: map[int]bool{}}

func ipodSizeKey(libraryID int) string {
	return fmt.Sprintf("IpodFolderSize-%d", libraryID)
}

// folderSize adds up the size of every file under root. What can't be read is left out
func folderSize(root string) (int64, error) {
	var total int64
	err := filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			if d == nil {
				return err // The root itself
			}
			return nil
		}
		if d.Type().IsRegular() {
			if info, err := d.Info(); err == nil {
				total += info.Size()
			}
		}
		return nil
	})
	return total, err
}

func (api *Router) getIpodSize(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	user, _ := request.UserFrom(ctx)
	if err != nil || !user.HasLibraryAccess(id) {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	lib, err := api.ds.Library(ctx).Get(id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	resp := ipodSizeResponse{ID: id}
	var cached ipodFolderSize
	raw, err := api.ds.Property(ctx).Get(ipodSizeKey(id))
	known := err == nil && json.Unmarshal([]byte(raw), &cached) == nil
	if known {
		resp.Size = &cached.Size
		resp.MeasuredAt = &cached.MeasuredAt
	}
	if !known || cached.MeasuredAt.Before(lib.LastScanAt) || time.Since(cached.MeasuredAt) > ipodSizeMaxAge {
		api.measureIpodSize(*lib)
		resp.Measuring = true
	}
	writeJSON(ctx, w, resp)
}

// measureIpodSize measures the iPod's folder in the background, unless it is being measured
func (api *Router) measureIpodSize(lib model.Library) {
	ipodSizing.Lock()
	if ipodSizing.running[lib.ID] {
		ipodSizing.Unlock()
		return
	}
	ipodSizing.running[lib.ID] = true
	ipodSizing.Unlock()

	go func() {
		defer func() {
			ipodSizing.Lock()
			delete(ipodSizing.running, lib.ID)
			ipodSizing.Unlock()
		}()
		ctx := context.Background()
		start := time.Now()
		size, err := folderSize(lib.Path)
		if err != nil {
			log.Warn(ctx, "Couldn't measure the iPod's folder", "library", lib.Name, "path", lib.Path, err)
			return
		}
		raw, _ := json.Marshal(ipodFolderSize{Size: size, MeasuredAt: time.Now()})
		if err := api.ds.Property(ctx).Put(ipodSizeKey(lib.ID), string(raw)); err != nil {
			log.Error(ctx, "Couldn't keep the iPod's folder size", "library", lib.Name, err)
			return
		}
		log.Debug(ctx, "Measured the iPod's folder", "library", lib.Name, "size", size, "elapsed", time.Since(start))
	}()
}
