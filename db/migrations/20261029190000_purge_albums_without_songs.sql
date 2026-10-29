-- +goose Up
-- Merging a combined library ("Music Library") into the iPod libraries inside it moved its tracks
-- but left their albums behind, empty: they showed with their old song count and opened with no
-- songs. The scan's cleanup only purges the libraries it scanned, which never included them
DELETE FROM album WHERE NOT EXISTS (SELECT 1 FROM media_file WHERE media_file.album_id = album.id);

-- +goose Down
-- Nothing to restore: the albums had no songs
