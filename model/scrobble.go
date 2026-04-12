package model

import "time"

type Scrobble struct {
	MediaFileID    string
	UserID         string
	SubmissionTime time.Time
}

// ListenEntry represents a single scrobble enriched with user and track info,
// used for the social activity feed.
type ListenEntry struct {
	UserID         string
	Username       string
	SubmissionTime time.Time
	MediaFile      MediaFile
}

type ScrobbleRepository interface {
	RecordScrobble(mediaFileID string, submissionTime time.Time) error
	// GetRecentAll returns the most recent scrobbles across all users who have
	// activity sharing enabled, ordered newest first.
	GetRecentAll(limit int) ([]ListenEntry, error)
}
