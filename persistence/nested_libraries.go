package persistence

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/pocketbase/dbx"
)

// A library can contain other libraries: on this server, the "Music Library" folder holds every
// iPod's folder, and each iPod is also its own library. Such a combined library stands for "all
// the libraries inside it": the scanner doesn't import the nested folders into it (see scanner's
// nestedRoots), the copies it imported before are merged into the nested libraries, access to it
// grants access to the nested libraries, and it is not shown in the library selector or as a
// Subsonic music folder.

type nestedPair struct {
	parent model.Library
	child  model.Library
	prefix string // Path of the child folder inside the parent, with a trailing "/"
}

func (r *libraryRepository) nestedPairs() ([]nestedPair, error) {
	libs, err := r.GetAll()
	if err != nil {
		return nil, err
	}
	var pairs []nestedPair
	for _, parent := range libs.Combined() {
		for _, child := range libs.Nested(parent) {
			rel, err := filepath.Rel(parent.Path, child.Path)
			if err != nil {
				return nil, err
			}
			pairs = append(pairs, nestedPair{parent: parent, child: child, prefix: filepath.ToSlash(rel) + "/"})
		}
	}
	return pairs, nil
}

// SyncNestedAccess gives users who can access a combined library access to all the libraries
// inside it (whose folder is inside its folder, as in model.Library.Contains).
//
// It is a single statement that writes without reading first, so it can start a transaction:
// SQLite then waits for the write lock as usual. A transaction that reads first and writes later
// fails at once with "database is locked" if anything else wrote in between, which made scans
// fail at their last step while people were listening
func (r *libraryRepository) SyncNestedAccess() error {
	_, err := r.db.NewQuery(`INSERT OR IGNORE INTO user_library (user_id, library_id)
SELECT ul.user_id, child.id
FROM library parent
JOIN library child ON child.id != parent.id
	AND substr(rtrim(child.path, '/'), 1, length(rtrim(parent.path, '/')) + 1) = rtrim(parent.path, '/') || '/'
JOIN user_library ul ON ul.library_id = parent.id`).Execute()
	if err != nil {
		return fmt.Errorf("granting access to nested libraries: %w", err)
	}
	return nil
}

// MergeNestedLibraries replaces the tracks a combined library imported from the folder of a
// library inside it with that library's own copies, keeping plays, ratings, stars, playlists,
// scrobbles, bookmarks, play queues and shares. Tracks without a copy in the nested library (not
// scanned yet) are left alone. Returns the number of merged tracks. Must run in a transaction
func (r *libraryRepository) MergeNestedLibraries() (int, error) {
	pairs, err := r.nestedPairs()
	if err != nil {
		return 0, err
	}
	total := 0
	for _, p := range pairs {
		n, err := r.mergeNested(p)
		if err != nil {
			return total, fmt.Errorf("merging library %d into %d: %w", p.parent.ID, p.child.ID, err)
		}
		if n > 0 {
			log.Info(r.ctx, "Merged tracks of combined library into nested library", "from", p.parent.Name,
				"into", p.child.Name, "tracks", n)
		}
		total += n
	}
	return total, nil
}

type nestedMerge struct {
	OldID    string `db:"old_id"`
	NewID    string `db:"new_id"`
	OldAlbum string `db:"old_album"`
	NewAlbum string `db:"new_album"`
}

func (r *libraryRepository) mergeNested(p nestedPair) (int, error) {
	var rows []nestedMerge
	err := r.db.NewQuery(`SELECT p.id AS old_id, c.id AS new_id, p.album_id AS old_album, c.album_id AS new_album
FROM media_file p
JOIN media_file c ON c.library_id = {:child} AND c.path = substr(p.path, length({:prefix}) + 1)
WHERE p.library_id = {:parent} AND substr(p.path, 1, length({:prefix})) = {:prefix}`).
		Bind(dbx.Params{"parent": p.parent.ID, "child": p.child.ID, "prefix": p.prefix}).All(&rows)
	if err != nil || len(rows) == 0 {
		return 0, err
	}

	tracks := make(map[string]string, len(rows))
	albums := map[string]string{}
	for _, m := range rows {
		tracks[m.OldID] = m.NewID
		if m.OldAlbum != "" && m.NewAlbum != "" {
			albums[m.OldAlbum] = m.NewAlbum
		}
	}

	steps := []func() error{
		func() error { return r.fillMergeTable(tracks) },
		func() error { return r.mergeAnnotations("media_file") },
		func() error { return r.repointColumn("playlist_tracks", "media_file_id") },
		func() error { return r.repointColumn("scrobbles", "media_file_id") },
		func() error { return r.repointBookmarks() },
		func() error {
			_, err := r.db.NewQuery("DELETE FROM media_file WHERE id IN (SELECT old_id FROM temp.nested_merge)").Execute()
			return err
		},
		func() error { return r.fillMergeTable(albums) },
		func() error { return r.mergeAnnotations("album") },
		func() error { return r.replaceIDLists("playqueue", "items", tracks) },
		func() error { return r.replaceIDLists("share", "resource_ids", tracks, albums) },
		func() error {
			_, err := r.db.NewQuery("DROP TABLE IF EXISTS temp.nested_merge").Execute()
			return err
		},
	}
	for _, step := range steps {
		if err := step(); err != nil {
			return 0, err
		}
	}
	return len(rows), nil
}

// fillMergeTable stores the old ID -> new ID mapping in a temporary table, used by the steps below
func (r *libraryRepository) fillMergeTable(mapping map[string]string) error {
	if _, err := r.db.NewQuery("DROP TABLE IF EXISTS temp.nested_merge").Execute(); err != nil {
		return err
	}
	if _, err := r.db.NewQuery("CREATE TEMP TABLE nested_merge (old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL)").Execute(); err != nil {
		return err
	}
	for oldID, newID := range mapping {
		_, err := r.db.NewQuery("INSERT INTO temp.nested_merge (old_id, new_id) VALUES ({:old}, {:new})").
			Bind(dbx.Params{"old": oldID, "new": newID}).Execute()
		if err != nil {
			return err
		}
	}
	return nil
}

// mergeAnnotations moves the annotations of the old items to the new ones. When a user already
// annotated the new item too, both are combined: play counts are added up, and the latest dates,
// the highest rating and any star are kept
func (r *libraryRepository) mergeAnnotations(itemType string) error {
	queries := []string{
		`UPDATE annotation AS n SET
	play_count = coalesce(n.play_count, 0) + coalesce(o.play_count, 0),
	play_date = nullif(max(coalesce(n.play_date, ''), coalesce(o.play_date, '')), ''),
	rating = max(coalesce(n.rating, 0), coalesce(o.rating, 0)),
	rated_at = nullif(max(coalesce(n.rated_at, ''), coalesce(o.rated_at, '')), ''),
	starred = n.starred OR o.starred,
	starred_at = nullif(max(coalesce(n.starred_at, ''), coalesce(o.starred_at, '')), '')
FROM annotation AS o JOIN temp.nested_merge m ON m.old_id = o.item_id
WHERE o.item_type = {:type} AND n.item_type = {:type} AND n.item_id = m.new_id AND n.user_id = o.user_id`,
		`DELETE FROM annotation WHERE item_type = {:type} AND item_id IN (SELECT old_id FROM temp.nested_merge)
AND EXISTS (SELECT 1 FROM annotation n JOIN temp.nested_merge m ON n.item_id = m.new_id
	WHERE m.old_id = annotation.item_id AND n.user_id = annotation.user_id AND n.item_type = {:type})`,
		`UPDATE annotation SET item_id = (SELECT new_id FROM temp.nested_merge WHERE old_id = annotation.item_id)
WHERE item_type = {:type} AND item_id IN (SELECT old_id FROM temp.nested_merge)`,
	}
	for _, q := range queries {
		if _, err := r.db.NewQuery(q).Bind(dbx.Params{"type": itemType}).Execute(); err != nil {
			return err
		}
	}
	return nil
}

func (r *libraryRepository) repointColumn(table, column string) error {
	_, err := r.db.NewQuery(fmt.Sprintf(`UPDATE %[1]s SET %[2]s = (SELECT new_id FROM temp.nested_merge WHERE old_id = %[1]s.%[2]s)
WHERE %[2]s IN (SELECT old_id FROM temp.nested_merge)`, table, column)).Execute()
	return err
}

// repointBookmarks moves bookmarks to the new tracks, keeping the existing bookmark when the user
// already bookmarked the new track
func (r *libraryRepository) repointBookmarks() error {
	if _, err := r.db.NewQuery(`UPDATE OR IGNORE bookmark SET item_id = (SELECT new_id FROM temp.nested_merge WHERE old_id = bookmark.item_id)
WHERE item_type = 'media_file' AND item_id IN (SELECT old_id FROM temp.nested_merge)`).Execute(); err != nil {
		return err
	}
	_, err := r.db.NewQuery(`DELETE FROM bookmark WHERE item_type = 'media_file' AND item_id IN (SELECT old_id FROM temp.nested_merge)`).Execute()
	return err
}

type idListRow struct {
	ID  string `db:"id"`
	IDs string `db:"ids"`
}

// replaceIDLists replaces old IDs with new ones in a column holding comma-separated IDs
func (r *libraryRepository) replaceIDLists(table, column string, mappings ...map[string]string) error {
	var rows []idListRow
	err := r.db.NewQuery(fmt.Sprintf("SELECT id, %s AS ids FROM %s WHERE coalesce(%s, '') != ''", column, table, column)).All(&rows)
	if err != nil {
		return err
	}
	for _, row := range rows {
		ids := strings.Split(row.IDs, ",")
		changed := false
		for i, id := range ids {
			for _, mapping := range mappings {
				if newID, ok := mapping[id]; ok {
					ids[i] = newID
					changed = true
					break
				}
			}
		}
		if !changed {
			continue
		}
		_, err := r.db.Update(table, dbx.Params{column: strings.Join(ids, ",")}, dbx.HashExp{"id": row.ID}).Execute()
		if err != nil {
			return err
		}
	}
	return nil
}
