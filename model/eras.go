package model

// EraYear is how much music on the server comes from one year, and how much of it the user has played
type EraYear struct {
	Year    int `json:"year"`
	Songs   int `json:"songs"`
	Albums  int `json:"albums"`
	Artists int `json:"artists"`
	Played  int `json:"played"`
}

// Eras is the music on the server, year by year. Undated counts the songs without a (sensible) year
type Eras struct {
	Years   []EraYear `json:"years"`
	Undated int       `json:"undated"`
}

// EraGenre is a genre of an era, by name, with its number of songs
type EraGenre struct {
	Name  string `json:"name"`
	Songs int    `json:"songs"`
}

// Era is what a stretch of years sounds like on the server
type Era struct {
	From    int              `json:"from"`
	To      int              `json:"to"`
	Songs   int              `json:"songs"`
	Played  int              `json:"played"`
	Artists []ListeningCount `json:"artists"` // most songs first
	Albums  []ListeningCount `json:"albums"`  // on the most iPods first
	Genres  []EraGenre       `json:"genres"`
	Ipods   []ListeningCount `json:"ipods"` // most songs from the era first
}

// EraSongsOptions picks songs from a stretch of years
type EraSongsOptions struct {
	From int
	To   int
	Max  int
	// Journey returns the songs in the order they came out, spread over every year. Otherwise they
	// are shuffled, with at most two songs per artist
	Journey    bool
	Genre      string // a genre name
	LibraryIDs []int
	Unplayed   bool // only songs the user has never played
}

type ErasRepository interface {
	// Eras returns how much music comes from each year
	Eras() (*Eras, error)
	// Era describes the music released between two years (both included)
	Era(from, to int, limit int) (*Era, error)
	// EraSongs picks songs released between two years, to play
	EraSongs(opts EraSongsOptions) (MediaFiles, error)
}
