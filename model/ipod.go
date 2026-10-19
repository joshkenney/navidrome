package model

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
	// DataVersion identifies the iPods the current user can access and their state. It changes
	// whenever a scan finishes or a library is added, changed or removed
	DataVersion() (string, error)
}
