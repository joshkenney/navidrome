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
}

// IpodArtistCount is the number of songs by an artist on an iPod
type IpodArtistCount struct {
	LibraryID  int    `json:"libraryId"`
	ArtistID   string `json:"artistId"`
	ArtistName string `json:"artistName"`
	SongCount  int    `json:"songCount"`
}

// IpodTotals holds library-wide numbers that can't be derived from per-iPod stats
type IpodTotals struct {
	DistinctSongs int    `json:"distinctSongs"`
	SharedSongs   int    `json:"sharedSongs"`
	TopGenre      string `json:"topGenre"`
	TopDecade     int    `json:"topDecade"`
}

type IpodRepository interface {
	// TopDuplicateSongs returns the songs found on the most iPods, most shared first
	TopDuplicateSongs(limit int) ([]IpodSong, error)
	// UniqueGems returns a random sample of songs found on only one iPod
	UniqueGems(limit int) ([]IpodGem, error)
	Stats() ([]IpodStats, error)
	Totals() (*IpodTotals, error)
	ArtistCounts() ([]IpodArtistCount, error)
	// DataVersion changes whenever a scan finishes or a library is added, changed or removed
	DataVersion() (string, error)
}
