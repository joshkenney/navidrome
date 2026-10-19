package model

import (
	"os"
	"path/filepath"
	"strings"
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

// AlbumCoverPath returns the path of an album's cover in the data folder, or "" if it has none.
// auto selects the cover found by the cover finder instead of the one set by an admin
func AlbumCoverPath(albumID string, auto bool) string {
	if albumID == "" || strings.ContainsAny(albumID, `*?[\/`) {
		return ""
	}
	prefix := AlbumCoverFilename(albumID, auto, ".")
	matches, _ := filepath.Glob(UploadedImagePath(consts.EntityAlbum, prefix+"*"))
	for _, path := range matches {
		ext := strings.TrimPrefix(filepath.Base(path), prefix)
		// "<id>.*" also matches "<id>.auto.jpg", which isn't a cover set by an admin
		if ext != "" && !strings.Contains(ext, ".") {
			return path
		}
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
