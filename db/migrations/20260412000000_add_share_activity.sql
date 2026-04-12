-- +goose Up
ALTER TABLE user ADD COLUMN share_activity boolean NOT NULL DEFAULT 1;

-- +goose Down
-- SQLite does not support dropping columns before version 3.35.0.
-- No-op: accept that the column remains on rollback.
