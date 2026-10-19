package model_test

import (
	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = DescribeTable("IsPodcast",
	func(genre, path string, expected bool) {
		Expect(model.IsPodcast(genre, path)).To(Equal(expected))
	},
	Entry("iTunes' Podcast genre", "Podcast", "Show/Episode.mp3", true),
	Entry("a genre mentioning podcasts", "Comedy Podcasts", "Show/Episode.mp3", true),
	Entry("iTunes' Podcasts folder", "", "iTunes Media/Podcasts/Show/Episode.mp3", true),
	Entry("a Podcasts folder at the root", "", "Podcasts/Show/Episode.mp3", true),
	Entry("a song", "Rock", "Weezer/Blue/01 My Name Is Jonas.mp3", false),
	Entry("a folder only named like it", "", "Podcastsss/Song.mp3", false),
)
