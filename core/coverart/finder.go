// Package coverart finds covers online for albums that have none, and keeps them in the data folder
// (see model.AlbumCoverPath), where the artwork code picks them up
package coverart

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Masterminds/squirrel"
	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/core/external"
	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/utils/songkey"
	_ "golang.org/x/image/webp"
)

const (
	missesKey     = "CoverFinderMisses"
	retryMissesIn = 30 * 24 * time.Hour
	maxImageSize  = 10 << 20
	// Albums (and folders) read at a time
	albumPageSize = 500
	// Misses are saved every this many lookups, and when a run ends
	saveMissesEvery = 200
	lookupTimeout   = 10 * time.Second
)

// errNotConfigured marks a source that can't be used, which doesn't count as searched
var errNotConfigured = errors.New("not configured")

// Hosts covers are downloaded from: the image servers of the sources searched
var defaultAllowedHosts = []string{".mzstatic.com", ".dzcdn.net", "lastfm.freetls.fastly.net"}

// Summary counts what a run did
type Summary struct {
	Found   int // Covers found and saved
	Missed  int // Albums no source had a confident match for
	Skipped int // Albums missed less than 30 days ago, or without a usable title
}

// Finder looks up covers for albums that have none: no image in their folders, no art embedded
// in their songs and no cover in the data folder. It searches iTunes and Deezer (both free, no key
// needed), then Last.fm when that is configured, and only keeps confident matches
type Finder struct {
	ds       model.DataStore
	provider external.Provider
	client   *http.Client

	ITunesURL    string
	DeezerURL    string
	AllowedHosts []string
	// Pause after each album looked up online, to stay within the sources' rate limits (iTunes
	// allows about 20 searches a minute)
	Delay time.Duration
	// Pause between pages of albums read from the database
	PagePause time.Duration
	// Stops a run while the library is being scanned
	IsScanning func() bool

	now     func() time.Time
	running atomic.Bool
}

func NewFinder(ds model.DataStore, provider external.Provider) *Finder {
	return &Finder{
		ds:           ds,
		provider:     provider,
		client:       &http.Client{Timeout: lookupTimeout},
		ITunesURL:    "https://itunes.apple.com/search",
		DeezerURL:    "https://api.deezer.com/search/album",
		AllowedHosts: defaultAllowedHosts,
		Delay:        conf.Server.CoverFinder.Delay,
		PagePause:    200 * time.Millisecond,
		IsScanning:   func() bool { return false },
		now:          time.Now,
	}
}

// Run looks up covers for all albums that have none. Only one run happens at a time: a call while
// another run is going returns right away
func (f *Finder) Run(ctx context.Context) (Summary, error) {
	var sum Summary
	if !f.running.CompareAndSwap(false, true) {
		return sum, nil
	}
	defer f.running.Store(false)

	misses := f.loadMisses(ctx)
	start := f.now()
	log.Info(ctx, "Cover finder: looking up albums without a cover")

	stopped, lookedUp := false, 0
	err := f.forEachAlbumWithoutCover(ctx, func(al model.Album) bool {
		if ctx.Err() != nil || f.IsScanning() {
			stopped = true
			return false
		}
		if tried, ok := misses[al.ID]; ok && f.now().Sub(tried) < retryMissesIn {
			sum.Skipped++
			return true
		}
		if songkey.AlbumKey(al.Name) == "" {
			sum.Skipped++
			return true
		}
		found, err := f.FindAlbum(ctx, al)
		switch {
		case err != nil:
			log.Warn(ctx, "Cover finder: error looking up album", "album", al.Name, "artist", al.AlbumArtist, err)
		case found:
			sum.Found++
			delete(misses, al.ID)
		default:
			sum.Missed++
			misses[al.ID] = f.now()
		}
		if lookedUp++; lookedUp%saveMissesEvery == 0 {
			f.saveMisses(ctx, misses)
		}
		f.pause(ctx)
		return true
	})
	f.saveMisses(ctx, misses)
	if err != nil {
		return sum, err
	}
	if stopped {
		log.Info(ctx, "Cover finder: stopped for a scan, or shutting down. The next run continues")
	}
	log.Info(ctx, "Cover finder: done", "found", sum.Found, "missed", sum.Missed, "skipped", sum.Skipped,
		"elapsed", time.Since(start))
	return sum, nil
}

// Reject keeps the finder from looking up an album again, after an admin removed the cover it found
func Reject(ctx context.Context, ds model.DataStore, albumID string) error {
	f := &Finder{ds: ds}
	misses := f.loadMisses(ctx)
	misses[albumID] = rejected
	return f.storeMisses(ctx, misses)
}

// A miss time that is never 30 days old
var rejected = time.Date(9999, 1, 1, 0, 0, 0, 0, time.UTC)

// ForgetMiss lets the next run look up an album again, even if it was missed recently
func ForgetMiss(ctx context.Context, ds model.DataStore, albumID string) error {
	f := &Finder{ds: ds}
	misses := f.loadMisses(ctx)
	if _, ok := misses[albumID]; !ok {
		return nil
	}
	delete(misses, albumID)
	return f.storeMisses(ctx, misses)
}

func (f *Finder) pause(ctx context.Context) {
	if f.Delay <= 0 {
		return
	}
	select {
	case <-ctx.Done():
	case <-time.After(f.Delay):
	}
}

// FindAlbum looks up a cover for one album and saves it. It returns false if no source had a
// confident match
func (f *Finder) FindAlbum(ctx context.Context, al model.Album) (bool, error) {
	lookups := []func(context.Context, model.Album) (string, error){f.searchITunes, f.searchDeezer, f.searchLastFM}
	var errs []error
	searched := 0
	for _, lookup := range lookups {
		imageURL, err := lookup(ctx, al)
		if errors.Is(err, errNotConfigured) {
			continue
		}
		if err != nil {
			errs = append(errs, err)
			continue
		}
		searched++
		if imageURL == "" {
			continue
		}
		data, ext, err := f.download(ctx, imageURL)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if err := saveAutoCover(al.ID, data, ext); err != nil {
			return false, err
		}
		log.Debug(ctx, "Cover finder: found cover", "album", al.Name, "artist", al.AlbumArtist, "url", imageURL)
		return true, nil
	}
	// When no source could be searched (down, rate limited), it's not a miss: the album is tried
	// again next run
	if searched == 0 {
		return false, errors.Join(errs...)
	}
	return false, nil
}

// matches tells whether a search result is the album: same artist and title, ignoring case,
// punctuation and edition suffixes. Compilations, and albums without a known artist, need the
// same title and, when both are known, the same year
func matches(al model.Album, artist, title string, year int) bool {
	want := songkey.AlbumKey(al.Name)
	if want == "" || songkey.AlbumKey(title) != want {
		return false
	}
	if isCompilation(al) {
		return year == 0 || al.MaxYear == 0 || (year >= al.MinYear && year <= al.MaxYear)
	}
	return songkey.ArtistKey(artist) == songkey.ArtistKey(al.AlbumArtist)
}

func isCompilation(al model.Album) bool {
	return al.Compilation || songkey.IsUnknownArtist(songkey.ArtistKey(al.AlbumArtist))
}

func (f *Finder) searchITunes(ctx context.Context, al model.Album) (string, error) {
	term := al.Name
	if !isCompilation(al) {
		term = al.AlbumArtist + " " + al.Name
	}
	params := url.Values{"entity": {"album"}, "limit": {"10"}, "term": {term}}
	var res struct {
		Results []struct {
			CollectionName string `json:"collectionName"`
			ArtistName     string `json:"artistName"`
			ArtworkURL100  string `json:"artworkUrl100"`
			ReleaseDate    string `json:"releaseDate"`
		} `json:"results"`
	}
	if err := f.getJSON(ctx, f.ITunesURL+"?"+params.Encode(), &res); err != nil {
		return "", fmt.Errorf("iTunes: %w", err)
	}
	for _, r := range res.Results {
		year, _ := strconv.Atoi(r.ReleaseDate[:min(4, len(r.ReleaseDate))])
		if r.ArtworkURL100 != "" && matches(al, r.ArtistName, r.CollectionName, year) {
			// The URL names the size: ask for 600x600 instead of 100x100
			return strings.Replace(r.ArtworkURL100, "100x100bb", "600x600bb", 1), nil
		}
	}
	return "", nil
}

func (f *Finder) searchDeezer(ctx context.Context, al model.Album) (string, error) {
	q := fmt.Sprintf(`album:"%s"`, al.Name)
	if !isCompilation(al) {
		q = fmt.Sprintf(`artist:"%s" %s`, al.AlbumArtist, q)
	}
	var res struct {
		Data []struct {
			Title   string `json:"title"`
			CoverXL string `json:"cover_xl"`
			Artist  struct {
				Name string `json:"name"`
			} `json:"artist"`
		} `json:"data"`
	}
	if err := f.getJSON(ctx, f.DeezerURL+"?"+url.Values{"q": {q}}.Encode(), &res); err != nil {
		return "", fmt.Errorf("deezer: %w", err)
	}
	for _, r := range res.Data {
		// Deezer's search results don't have a year: compilations need iTunes or Last.fm
		if r.CoverXL != "" && !isCompilation(al) && matches(al, r.Artist.Name, r.Title, 0) {
			return r.CoverXL, nil
		}
	}
	return "", nil
}

// searchLastFM uses Navidrome's own album image lookup, which works when Last.fm is configured.
// Last.fm already matches by artist and title
func (f *Finder) searchLastFM(ctx context.Context, al model.Album) (string, error) {
	if f.provider == nil || !conf.Server.LastFM.Enabled || conf.Server.LastFM.ApiKey == "" {
		return "", errNotConfigured
	}
	u, err := f.provider.AlbumImage(ctx, al.ID)
	if err != nil || u == nil {
		// Not found, or Last.fm not usable: not an error worth reporting
		return "", nil //nolint:nilerr
	}
	return u.String(), nil
}

func (f *Finder) getJSON(ctx context.Context, rawURL string, v any) error {
	ctx, cancel := context.WithTimeout(ctx, lookupTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", consts.HTTPUserAgent)
	resp, err := f.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, maxImageSize)).Decode(v)
}

func (f *Finder) allowed(u *url.URL) bool {
	if u.Scheme != "https" && u.Scheme != "http" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, allowed := range f.AllowedHosts {
		if host == strings.TrimPrefix(allowed, ".") || (strings.HasPrefix(allowed, ".") && strings.HasSuffix(host, allowed)) {
			return true
		}
	}
	return false
}

// download fetches an image from one of the allowed hosts, returning it with its extension
func (f *Finder) download(ctx context.Context, rawURL string) ([]byte, string, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, "", err
	}
	if !f.allowed(u) {
		return nil, "", fmt.Errorf("cover host not allowed: %s", u.Hostname())
	}
	ctx, cancel := context.WithTimeout(ctx, lookupTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", consts.HTTPUserAgent)
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("downloading cover: status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxImageSize+1))
	if err != nil {
		return nil, "", err
	}
	if len(data) > maxImageSize {
		return nil, "", errors.New("cover too large")
	}
	_, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("not an image: %w", err)
	}
	if format == "jpeg" {
		format = "jpg"
	}
	return data, "." + format, nil
}

// saveAutoCover replaces the album's found cover. It writes to a temporary file first, so the
// artwork code never reads half a cover
func saveAutoCover(albumID string, data []byte, ext string) error {
	path := model.UploadedImagePath(consts.EntityAlbum, model.AlbumCoverFilename(albumID, true, ext))
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		return err
	}
	if old := model.AlbumCoverPath(albumID, true); old != "" && old != path {
		_ = os.Remove(old)
		model.RecordAlbumCover(old)
	}
	if err := os.Rename(tmp, path); err != nil {
		return err
	}
	model.RecordAlbumCover(path)
	return nil
}

// forEachAlbumWithoutCover calls fn for each album the artwork code has no cover for (no art
// embedded in its songs, no image in its folders matching CoverArtPriority, no cover in the data
// folder), until fn returns false. There can be hundreds of thousands of albums, so they are read a
// page at a time, each page starting after the last album of the previous one (an OFFSET would
// make the database go through all the previous albums again for every page), with a pause
// between pages to leave the database to the other users
func (f *Finder) forEachAlbumWithoutCover(ctx context.Context, fn func(model.Album) bool) error {
	patterns := coverFilePatterns()
	lastID := ""
	for {
		albums, err := f.ds.Album(ctx).GetAll(model.QueryOptions{
			Filters: squirrel.And{
				squirrel.Eq{"embed_art_path": ""},
				squirrel.Eq{"album.missing": false},
				squirrel.Gt{"album.id": lastID},
			},
			Sort: "album.id", Max: albumPageSize,
		})
		if err != nil {
			return err
		}
		if len(albums) > 0 {
			lastID = albums[len(albums)-1].ID
		}
		folders, err := f.foldersOf(ctx, albums)
		if err != nil {
			return err
		}
		for _, al := range albums {
			if hasCoverFile(al, folders, patterns) || model.AlbumCoverKind(al.ID) != "" {
				continue
			}
			if !fn(al) {
				return nil
			}
		}
		if len(albums) < albumPageSize {
			return nil
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(f.PagePause):
		}
	}
}

// foldersOf returns the folders of the albums, and the parents of multi-folder albums' folders
func (f *Finder) foldersOf(ctx context.Context, albums model.Albums) (map[string]model.Folder, error) {
	folders := map[string]model.Folder{}
	var ids []string
	for _, al := range albums {
		ids = append(ids, al.FolderIDs...)
	}
	if err := f.loadFolders(ctx, folders, ids); err != nil {
		return nil, err
	}
	var parents []string
	for _, al := range albums {
		if len(al.FolderIDs) < 2 {
			continue
		}
		for _, id := range al.FolderIDs {
			if p := folders[id].ParentID; p != "" {
				if _, ok := folders[p]; !ok {
					parents = append(parents, p)
				}
			}
		}
	}
	return folders, f.loadFolders(ctx, folders, parents)
}

func (f *Finder) loadFolders(ctx context.Context, folders map[string]model.Folder, ids []string) error {
	ids = slices.Compact(slices.Sorted(slices.Values(ids)))
	for chunk := range slices.Chunk(ids, albumPageSize) {
		list, err := f.ds.Folder(ctx).GetAll(model.QueryOptions{
			Filters: squirrel.And{squirrel.Eq{"folder.id": chunk}, squirrel.Eq{"folder.missing": false}},
		})
		if err != nil {
			return err
		}
		for _, folder := range list {
			folders[folder.ID] = folder
		}
	}
	return nil
}

// coverFilePatterns returns the file name patterns of CoverArtPriority ("cover.*", "folder.*")
func coverFilePatterns() []string {
	var patterns []string
	for p := range strings.SplitSeq(strings.ToLower(conf.Server.CoverArtPriority), ",") {
		p = strings.TrimSpace(p)
		if p != "" && p != "embedded" && p != "external" {
			patterns = append(patterns, p)
		}
	}
	return patterns
}

// hasCoverFile tells whether one of the album's folders, or their shared parent folder for
// multi-disc albums (as the artwork code looks there too), has an image used as cover
func hasCoverFile(al model.Album, folders map[string]model.Folder, patterns []string) bool {
	var albumFolders []model.Folder
	for _, id := range al.FolderIDs {
		if folder, ok := folders[id]; ok {
			albumFolders = append(albumFolders, folder)
		}
	}
	if len(albumFolders) > 1 {
		parentID := albumFolders[0].ParentID
		shared := parentID != ""
		for _, folder := range albumFolders[1:] {
			shared = shared && folder.ParentID == parentID
		}
		if parent, ok := folders[parentID]; shared && ok {
			albumFolders = append(albumFolders, parent)
		}
	}
	for _, folder := range albumFolders {
		for _, file := range folder.ImageFiles {
			name := strings.ToLower(filepath.Base(file))
			for _, pattern := range patterns {
				if ok, _ := filepath.Match(pattern, name); ok {
					return true
				}
			}
		}
	}
	return false
}

func (f *Finder) loadMisses(ctx context.Context) map[string]time.Time {
	misses := map[string]time.Time{}
	raw, err := f.ds.Property(ctx).DefaultGet(missesKey, "")
	if err != nil || raw == "" {
		return misses
	}
	if err := json.Unmarshal([]byte(raw), &misses); err != nil {
		log.Warn(ctx, "Cover finder: could not read the albums missed before", err)
		return map[string]time.Time{}
	}
	return misses
}

func (f *Finder) saveMisses(ctx context.Context, misses map[string]time.Time) {
	if err := f.storeMisses(ctx, misses); err != nil {
		log.Warn(ctx, "Cover finder: could not save the albums missed", err)
	}
}

func (f *Finder) storeMisses(ctx context.Context, misses map[string]time.Time) error {
	raw, err := json.Marshal(misses)
	if err != nil {
		return err
	}
	return f.ds.Property(ctx).Put(missesKey, string(raw))
}
