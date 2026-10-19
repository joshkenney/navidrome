package model

import (
	"path/filepath"
	"strings"
)

// Each library in this server is the music collection of one real iPod. The types below
// back the "iPod facts" and "iPod network" features, which compare libraries with each other.

// IpodSong is a song (matched by title + artist) found on more than one iPod
type IpodSong struct {
	MediaFileID string   `json:"id"`
	Title       string   `json:"title"`
	Artist      string   `json:"artist"`
	IpodCount   int      `json:"ipodCount"`
	IpodNames   []string `json:"ipodNames"`
}

// IpodSongEntry is a song (matched by Key, see utils/songkey) as found on one iPod
type IpodSongEntry struct {
	Key         string
	LibraryID   int
	MediaFileID string
	Title       string
	Artist      string
	Spoken      bool // Spoken word: see IsSpokenWord
}

// Genres, folders and names that mark spoken word: podcasts, audiobooks, lectures
var (
	spokenGenres  = []string{"podcast", "audiobook", "audio book", "spoken", "speech", "lecture"}
	spokenFolders = []string{"/podcasts/", "/audiobooks/"}
)

// SpokenGenres and SpokenFolders are the markers IsSpokenWord looks for, also used in SQL
func SpokenGenres() []string  { return spokenGenres }
func SpokenFolders() []string { return spokenFolders }

// IsSpokenWord tells whether a track is a podcast episode, an audiobook or a lecture: by its genre
// (iTunes tags podcasts "Podcast"), its folder (iTunes keeps them in "Podcasts" and "Audiobooks"),
// "podcast" in its artist or album, or its format (.m4b audiobooks). Albums made of many long
// tracks are spotted too, but only in the iPod data (see the iPod repository's SongIndex)
func IsSpokenWord(mf MediaFile) bool {
	genre := strings.ToLower(mf.Genre)
	for _, g := range spokenGenres {
		if strings.Contains(genre, g) {
			return true
		}
	}
	path := "/" + strings.ToLower(filepath.ToSlash(mf.Path))
	for _, f := range spokenFolders {
		if strings.Contains(path, f) {
			return true
		}
	}
	return strings.Contains(strings.ToLower(mf.Artist+" "+mf.Album), "podcast") ||
		strings.EqualFold(mf.Suffix, "m4b")
}

// IpodGem is a song found on exactly one iPod
type IpodGem struct {
	MediaFileID string `json:"id"`
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	LibraryID   int    `json:"libraryId"`
	LibraryName string `json:"libraryName"`
}

// IpodStats holds aggregated numbers for a single iPod
type IpodStats struct {
	LibraryID     int     `json:"id"`
	Name          string  `json:"name"`
	SongCount     int     `json:"songCount"`
	DistinctSongs int     `json:"distinctSongs"`
	UniqueSongs   int     `json:"uniqueSongs"`
	ArtistCount   int     `json:"artistCount"`
	GenreCount    int     `json:"genreCount"`
	TotalDuration float64 `json:"totalDuration"`
	TotalSize     int64   `json:"totalSize"`
	AvgYear       float64 `json:"avgYear"`
	Taste         int     `json:"taste"`
}

// IpodArtistCount is the number of songs by an artist on an iPod. Spellings of the same
// artist ("The Spill Canvas", "Spill Canvas") share the same Key (see songkey.ArtistKey)
type IpodArtistCount struct {
	Key        string `json:"key"`
	LibraryID  int    `json:"libraryId"`
	ArtistID   string `json:"artistId"`
	ArtistName string `json:"artistName"`
	SongCount  int    `json:"songCount"`
}

// IpodGenreCount is the number of songs of a genre on an iPod
type IpodGenreCount struct {
	LibraryID int
	Genre     string // Lowercase
	SongCount int
}

// IpodArtistPlays is how many times the current user played songs by an artist (by Key)
type IpodArtistPlays struct {
	Key   string
	Plays int
}

// IpodTotals holds library-wide numbers that can't be derived from per-iPod stats
type IpodTotals struct {
	TopGenre  string `json:"topGenre"`
	TopDecade int    `json:"topDecade"`
}

// IpodRepository only considers iPods: libraries that contain other libraries (like a
// "Music Library" holding every iPod's folder) are left out, as they would count every song twice
type IpodRepository interface {
	// SongIndex returns one entry per song per iPod, leaving out placeholder songs
	SongIndex() ([]IpodSongEntry, error)
	// Stats returns per-iPod numbers. DistinctSongs and UniqueSongs are not filled in,
	// as they are derived from the SongIndex
	Stats() ([]IpodStats, error)
	Totals() (*IpodTotals, error)
	ArtistCounts() ([]IpodArtistCount, error)
	// ArtistKeys returns the artist Key (see IpodArtistCount) of each of the given artist IDs
	ArtistKeys(artistIDs []string) (map[string]string, error)
	// UserArtistPlays returns the current user's play counts per artist Key
	UserArtistPlays() ([]IpodArtistPlays, error)
	// GenreCounts returns the number of songs per genre on each iPod
	GenreCounts() ([]IpodGenreCount, error)
	// DataVersion identifies the iPods the current user can access and their state. It changes
	// whenever a scan finishes or a library is added, changed or removed
	DataVersion() (string, error)
}
