package model

import "time"

// TimelineOptions selects a stretch of a user's listening history
type TimelineOptions struct {
	From time.Time
	To   time.Time // exclusive
	// TZOffset is the listener's offset from UTC in minutes, so plays are grouped by the listener's days
	TZOffset int
	Offset   int // paging of the plays list
	Max      int
}

// ListeningDay is the listening of one day, in the listener's time zone
type ListeningDay struct {
	Date    string  `json:"date"` // YYYY-MM-DD
	Plays   int     `json:"plays"`
	Seconds float64 `json:"seconds"`
}

// ListeningCount is an artist, album, song or iPod with how often it was played
type ListeningCount struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Artist      string    `json:"artist,omitempty"`
	ArtistID    string    `json:"artistId,omitempty"`
	AlbumID     string    `json:"albumId,omitempty"`
	LibraryID   int       `json:"libraryId,omitempty"`
	LibraryName string    `json:"libraryName,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt,omitzero"`
	Plays       int       `json:"plays"`
	LastPlayed  time.Time `json:"lastPlayed,omitzero"`
	Songs       int       `json:"songs,omitempty"`
	Ipods       int       `json:"ipods,omitempty"`
}

type ListeningTotals struct {
	Plays   int     `json:"plays"`
	Seconds float64 `json:"seconds"`
	Songs   int     `json:"songs"`
	Albums  int     `json:"albums"`
	Artists int     `json:"artists"`
}

type Timeline struct {
	Days       []ListeningDay   `json:"days"`
	Totals     ListeningTotals  `json:"totals"`
	TopArtists []ListeningCount `json:"topArtists"`
	TopAlbums  []ListeningCount `json:"topAlbums"`
	TopSongs   []ListeningCount `json:"topSongs"`
	TopIpods   []ListeningCount `json:"topIpods"`
	Plays      []ListenEntry    `json:"-"`
	// First and Last are the user's first and last plays ever, so the UI knows how far back it can go
	First time.Time `json:"first,omitzero"`
	Last  time.Time `json:"last,omitzero"`
}

// Coverage is how much of something (an iPod, a decade, a genre) a user has played
type Coverage struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	LibraryID   int    `json:"libraryId,omitempty"`
	LibraryName string `json:"libraryName,omitempty"`
	Total       int    `json:"total"`
	Played      int    `json:"played"`
}

// CommunityArtist is an artist that other listeners play and the user never has
type CommunityArtist struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Listeners []string `json:"listeners"`
	Plays     int      `json:"plays"`
	Songs     int      `json:"songs"`
}

// Holes are the parts of the server a user hasn't explored, or has stopped listening to
type Holes struct {
	Ipods           []Coverage        `json:"ipods"`
	Decades         []Coverage        `json:"decades"`
	Genres          []Coverage        `json:"genres"`
	Artists         []ListeningCount  `json:"artists"` // never played, most songs first
	Albums          []ListeningCount  `json:"albums"`  // never played, on the most iPods first
	ForgottenArtist []ListeningCount  `json:"forgottenArtists"`
	ForgottenAlbums []ListeningCount  `json:"forgottenAlbums"`
	ForgottenSongs  []ListeningCount  `json:"forgottenSongs"`
	Community       []CommunityArtist `json:"community"`
	Days            []ListeningDay    `json:"-"` // all listening days, for finding the gaps
}

// HolesOptions tunes what counts as a hole
type HolesOptions struct {
	ForgottenBefore time.Time // favourites not played since this time are forgotten
	TZOffset        int
	Max             int
}

// ListeningUser is a listener who shares their activity
type ListeningUser struct {
	ID         string    `json:"id"`
	UserName   string    `json:"username"`
	Name       string    `json:"name"`
	Plays      int       `json:"plays"`
	LastPlayed time.Time `json:"lastPlayed,omitzero"`
}

// ListenMatch is a song a listener played, with how often and when they last did
type ListenMatch struct {
	ListenEntry
	Plays int
}

type ListeningRepository interface {
	// Timeline returns the listening of a user between two times
	Timeline(userID string, opts TimelineOptions) (*Timeline, error)
	// Holes returns the unexplored and forgotten parts of the server for the current user
	Holes(opts HolesOptions) (*Holes, error)
	// SearchUsers finds listeners sharing their activity, and the current user, by name
	SearchUsers(q string, limit int) ([]ListeningUser, error)
	// SearchListens finds songs that listeners sharing their activity have played, by title, artist or album
	SearchListens(q string, limit int) ([]ListenMatch, error)
}

// SearchOptions is a search across the library, with filters
type SearchOptions struct {
	Query      string
	LibraryIDs []int
	YearFrom   int
	YearTo     int
	GenreID    string
	Played     string // "played", "unplayed" or empty for both
	Offset     int
	Max        int
}

const (
	SearchPlayed   = "played"
	SearchUnplayed = "unplayed"
)

// SearchRepository searches titles and names, and also comments, lyrics and record labels
type SearchRepository interface {
	Artists(opts SearchOptions) (Artists, error)
	Albums(opts SearchOptions) (Albums, error)
	Songs(opts SearchOptions) (MediaFiles, error)
}
