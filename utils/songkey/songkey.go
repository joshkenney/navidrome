// Package songkey identifies "the same song" across different collections, ignoring
// differences in casing, track number prefixes and version suffixes like "(Remastered)".
package songkey

import (
	"regexp"
	"strings"

	"github.com/deluan/sanitize"
	"github.com/navidrome/navidrome/consts"
)

var (
	spaces = regexp.MustCompile(`\s+`)

	// Titles taggers and rippers use when the real title is unknown: "Track 05", "05 Track 05", "Untitled"
	placeholderTitle = regexp.MustCompile(`^(\d{1,3}[\s._-]*)?((audio\s*)?track|piste|pista|titel|faixa)[\s._-]*\d*$|` +
		`^\d{1,3}$|^(untitled|unknown|no title|sans titre)([\s._-]*(track)?[\s._-]*\d+)?$`)

	// "05 - Song", "05. Song"
	trackNumberPrefix = regexp.MustCompile(`^\d{1,3}\s*[-.]\s*`)

	// Trailing "(...)", "[...]" or " - ..." suffixes
	bracketSuffix = regexp.MustCompile(`\s*[(\[]([^()\[\]]*)[)\]]$`)
	dashSuffix    = regexp.MustCompile(`\s+-\s+([^-]+)$`)

	// Suffixes that mark another release of the same recording...
	versionWords = regexp.MustCompile(`\b(remaster(ed)?|explicit|clean|live|mono|stereo|deluxe|bonus|` +
		`single version|album version|radio edit|radio version|feat|ft|featuring)\b`)
	// ...unless they mark a different recording
	differentRecordingWords = regexp.MustCompile(`\b(remix|mix|instrumental|acoustic|demo|karaoke|cover)\b`)

	artistAnd         = regexp.MustCompile(`\s*[&+]\s*`)
	artistPunctuation = regexp.MustCompile(`[^\p{L}\p{N}\s]`)
)

// Key returns the key used to match a song across collections, or "" if the song is a
// placeholder (unknown artist, or a title like "Track 05") that should not be matched at all.
// The artist is matched by name (see ArtistKey), falling back to its ID
func Key(title, artistID, artistName string) string {
	if artistID == "" || artistID == consts.UnknownArtistID {
		return ""
	}
	t := normalizeTitle(title)
	if t == "" {
		return ""
	}
	artist := ArtistKey(artistName)
	if IsUnknownArtist(artist) {
		return ""
	}
	if artist == "" {
		artist = artistID
	}
	return t + "|" + artist
}

// UnknownArtistKeys are the artist Keys of tracks without a real artist: Navidrome's
// "[Unknown Artist]" and what taggers write when they don't know the artist. They are matched
// by name, as the scanner's ID for "[Unknown Artist]" depends on the configured ID scheme
var UnknownArtistKeys = []string{ArtistKey(consts.UnknownArtist), "unknown", "various", "unknown artist"}

// IsUnknownArtist tells whether an artist Key is one of the UnknownArtistKeys
func IsUnknownArtist(key string) bool {
	for _, k := range UnknownArtistKeys {
		if key == k {
			return true
		}
	}
	return false
}

// ArtistKey matches spellings of the same artist name: "The Spill Canvas" and "Spill Canvas",
// "Panic! At The Disco" and "Panic at the Disco", "Simon & Garfunkel" and "Simon and Garfunkel"
func ArtistKey(name string) string {
	k := strings.ToLower(sanitize.Accents(strings.TrimSpace(name)))
	k = artistAnd.ReplaceAllString(k, " and ")
	k = artistPunctuation.ReplaceAllString(k, "")
	k = strings.TrimSpace(spaces.ReplaceAllString(k, " "))
	if rest, ok := strings.CutPrefix(k, "the "); ok {
		k = rest
	}
	if k == "" {
		// Names made only of punctuation, like "!!!"
		return strings.ToLower(strings.TrimSpace(name))
	}
	return k
}

func normalizeTitle(title string) string {
	t := strings.TrimSpace(spaces.ReplaceAllString(strings.ToLower(title), " "))
	if placeholderTitle.MatchString(t) {
		return ""
	}
	t = trackNumberPrefix.ReplaceAllString(t, "")
	for {
		stripped := stripVersionSuffix(t)
		if stripped == t {
			break
		}
		t = stripped
	}
	if placeholderTitle.MatchString(t) {
		return ""
	}
	return t
}

func stripVersionSuffix(t string) string {
	for _, suffix := range []*regexp.Regexp{bracketSuffix, dashSuffix} {
		m := suffix.FindStringSubmatchIndex(t)
		if m == nil {
			continue
		}
		content := t[m[2]:m[3]]
		if versionWords.MatchString(content) && !differentRecordingWords.MatchString(content) {
			return strings.TrimSpace(t[:m[0]])
		}
	}
	return t
}
