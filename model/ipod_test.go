package model_test

import (
	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = DescribeTable("IsSpokenWord",
	func(mf model.MediaFile, expected bool) {
		Expect(model.IsSpokenWord(mf)).To(Equal(expected))
	},
	Entry("iTunes' Podcast genre", model.MediaFile{Genre: "Podcast", Path: "Show/Episode.mp3"}, true),
	Entry("an audiobook genre", model.MediaFile{Genre: "Audiobooks", Path: "Author/Book/01.mp3"}, true),
	Entry("a spoken word genre", model.MediaFile{Genre: "Books & Spoken", Path: "a.mp3"}, true),
	Entry("iTunes' Podcasts folder", model.MediaFile{Path: "iTunes Media/Podcasts/Show/Episode.mp3"}, true),
	Entry("iTunes' Audiobooks folder", model.MediaFile{Path: "iTunes Media/Audiobooks/Author/Book.mp3"}, true),
	Entry("podcast in the album", model.MediaFile{Album: "Distorted View: Daily Comedy Podcast", Path: "a.mp3"}, true),
	Entry("an .m4b audiobook", model.MediaFile{Suffix: "M4B", Path: "Book.m4b"}, true),
	Entry("a song", model.MediaFile{Genre: "Rock", Artist: "Weezer", Album: "Blue", Path: "Weezer/Blue/01.mp3", Suffix: "mp3"}, false),
	Entry("a folder only named like it", model.MediaFile{Path: "Podcastsss/Song.mp3"}, false),
)
