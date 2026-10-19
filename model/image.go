package model

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/consts"
)

// UploadedImagePath returns the absolute filesystem path for a manually uploaded
// entity cover image. Returns empty string if filename is empty.
func UploadedImagePath(entityType, filename string) string {
	if filename == "" {
		return ""
	}
	return filepath.Join(conf.Server.DataFolder, consts.ArtworkFolder, entityType, filename)
}

// Album covers kept in the data folder (no DB column): "<albumID>.<ext>" is a cover set by an
// admin, "<albumID>.auto.<ext>" one found online by the cover finder
const autoCoverTag = "auto"

// AlbumCoverFilename returns the file name for an album cover with the given extension (".jpg")
func AlbumCoverFilename(albumID string, auto bool, ext string) string {
	if auto {
		return albumID + "." + autoCoverTag + ext
	}
	return albumID + ext
}

// albumCovers indexes the album covers folder, which can hold a cover for each of hundreds of
// thousands of albums: the artwork code checks it for every album image served. The folder is
// read again only when it changed (its modification time), or when told so by RecordAlbumCover
var albumCovers = struct {
	sync.Mutex
	dir     string
	dirTime time.Time
	loaded  bool
	files   map[string]string // "<albumID>" or "<albumID>.auto" -> file name
}{}

func albumCoversDir() string {
	return filepath.Join(conf.Server.DataFolder, consts.ArtworkFolder, consts.EntityAlbum)
}

// coverIndexKey returns the index key of a cover file name, or "" if it isn't a cover
func coverIndexKey(name string) string {
	ext := filepath.Ext(name)
	key := strings.TrimSuffix(name, ext)
	if ext == "" || key == "" || strings.HasSuffix(name, ".tmp") {
		return ""
	}
	return key
}

// loadAlbumCovers reads the folder again if it changed. Call with albumCovers locked
func loadAlbumCovers() {
	dir := albumCoversDir()
	info, err := os.Stat(dir)
	if err != nil {
		albumCovers.files, albumCovers.loaded, albumCovers.dir, albumCovers.dirTime = map[string]string{}, true, dir, time.Time{}
		return
	}
	if albumCovers.loaded && albumCovers.dir == dir && info.ModTime().Equal(albumCovers.dirTime) {
		return
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	files := make(map[string]string, len(entries))
	for _, e := range entries {
		if key := coverIndexKey(e.Name()); key != "" && !e.IsDir() {
			files[key] = e.Name()
		}
	}
	albumCovers.files, albumCovers.loaded, albumCovers.dir, albumCovers.dirTime = files, true, dir, info.ModTime()
}

// RecordAlbumCover updates the index after a cover file was written (or removed, when gone),
// without reading the whole folder again
func RecordAlbumCover(path string) {
	albumCovers.Lock()
	defer albumCovers.Unlock()
	loadAlbumCovers()
	name := filepath.Base(path)
	key := coverIndexKey(name)
	if key == "" {
		return
	}
	if _, err := os.Stat(path); err == nil {
		albumCovers.files[key] = name
	} else if albumCovers.files[key] == name {
		delete(albumCovers.files, key)
	}
	if info, err := os.Stat(albumCoversDir()); err == nil {
		albumCovers.dirTime = info.ModTime()
	}
}

// AlbumCoverPath returns the path of an album's cover in the data folder, or "" if it has none.
// auto selects the cover found by the cover finder instead of the one set by an admin
func AlbumCoverPath(albumID string, auto bool) string {
	if albumID == "" {
		return ""
	}
	key := albumID
	if auto {
		key += "." + autoCoverTag
	}
	albumCovers.Lock()
	defer albumCovers.Unlock()
	loadAlbumCovers()
	if name, ok := albumCovers.files[key]; ok {
		return filepath.Join(albumCoversDir(), name)
	}
	return ""
}

// AlbumCoverKind tells which kind of cover an album has in the data folder: "manual" (set by an
// admin, which wins), "auto" (found by the cover finder) or ""
func AlbumCoverKind(albumID string) string {
	switch {
	case AlbumCoverPath(albumID, false) != "":
		return "manual"
	case AlbumCoverPath(albumID, true) != "":
		return "auto"
	}
	return ""
}

// AlbumCoverUpdatedAt returns when the album's covers in the data folder last changed, or the
// zero time if it has none
func AlbumCoverUpdatedAt(albumID string) time.Time {
	var latest time.Time
	for _, auto := range []bool{false, true} {
		if path := AlbumCoverPath(albumID, auto); path != "" {
			if info, err := os.Stat(path); err == nil && info.ModTime().After(latest) {
				latest = info.ModTime()
			}
		}
	}
	return latest
}
