package nativeapi

import (
	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Best copies on the iPods", func() {
	song := func(id string, lib int, title, suffix string, bitRate, bitDepth, sampleRate int) model.MediaFile {
		return model.MediaFile{
			ID: id, LibraryID: lib, LibraryName: "iPod " + id, Title: title, ArtistID: "a1",
			OrderArtistName: "artist", Artist: "Artist", Suffix: suffix, BitRate: bitRate,
			BitDepth: bitDepth, SampleRate: sampleRate, Duration: 200, Size: int64(bitRate),
		}
	}
	mp3 := func(id string, lib int, title string, bitRate int) model.MediaFile {
		return song(id, lib, title, "mp3", bitRate, 0, 44100)
	}
	flac := func(id string, lib int, title string, bitDepth, sampleRate int) model.MediaFile {
		return song(id, lib, title, "flac", 1000, bitDepth, sampleRate)
	}

	Describe("compareQuality", func() {
		It("puts lossless above any lossy bit rate", func() {
			Expect(compareQuality(flac("1", 1, "S", 16, 44100), mp3("2", 1, "S", 320))).To(BeNumerically(">", 0))
			Expect(compareQuality(mp3("2", 1, "S", 320), flac("1", 1, "S", 16, 44100))).To(BeNumerically("<", 0))
		})
		It("compares lossy copies by bit rate", func() {
			Expect(compareQuality(mp3("1", 1, "S", 256), mp3("2", 1, "S", 128))).To(BeNumerically(">", 0))
		})
		It("compares lossless copies by bit depth, then sample rate", func() {
			Expect(compareQuality(flac("1", 1, "S", 24, 44100), flac("2", 1, "S", 16, 96000))).To(BeNumerically(">", 0))
			Expect(compareQuality(flac("1", 1, "S", 24, 96000), flac("2", 1, "S", 24, 44100))).To(BeNumerically(">", 0))
		})
		It("knows ALAC in .m4a files is lossless", func() {
			alac := song("1", 1, "S", "m4a", 900, 16, 44100)
			aac := song("2", 1, "S", "m4a", 256, 0, 44100)
			Expect(compareQuality(alac, aac)).To(BeNumerically(">", 0))
		})
		It("finds equal copies equal", func() {
			Expect(compareQuality(mp3("1", 1, "S", 128), mp3("2", 2, "S", 128))).To(BeZero())
		})
	})

	Describe("bestSongCopy", func() {
		It("recommends a better copy from another iPod", func() {
			current := mp3("1", 1, "Song", 128)
			r := bestSongCopy(current, model.MediaFiles{current, mp3("2", 2, "Song", 256), flac("3", 3, "Song", 16, 44100)})
			Expect(r.Copies).To(Equal(3))
			Expect(r.Best).ToNot(BeNil())
			Expect(r.Best.ID).To(Equal("3"))
			Expect(r.Best.Lossless).To(BeTrue())
		})
		It("recommends nothing when the song is already the best copy", func() {
			current := flac("1", 1, "Song", 16, 44100)
			r := bestSongCopy(current, model.MediaFiles{current, mp3("2", 2, "Song", 320), flac("3", 3, "Song", 16, 44100)})
			Expect(r.Copies).To(Equal(3))
			Expect(r.Best).To(BeNil())
		})
		It("leaves out versions of a different length, like live ones", func() {
			current := mp3("1", 1, "Song", 128)
			live := flac("2", 2, "Song - Live", 16, 44100)
			live.Duration = 260
			r := bestSongCopy(current, model.MediaFiles{live})
			Expect(r.Copies).To(Equal(1))
			Expect(r.Best).To(BeNil())
		})
	})

	Describe("completeAlbum", func() {
		track := func(mf model.MediaFile, n int) model.MediaFile {
			mf.TrackNumber = n
			mf.DiscNumber = 1
			return mf
		}

		It("adds missing songs and upgrades songs from other iPods, in album order", func() {
			own := model.MediaFiles{
				track(mp3("o1", 1, "One", 128), 1),
				track(flac("o3", 1, "Three", 16, 44100), 3),
			}
			others := model.MediaFiles{
				track(flac("b1", 2, "One", 16, 44100), 1),
				track(mp3("b2", 2, "Two", 256), 2),
				track(mp3("c2", 3, "Two", 320), 2),
				track(mp3("b3", 2, "Three", 320), 3),
			}
			r := completeAlbum(own, others)
			Expect(r.Tracks).To(HaveLen(3))
			Expect(r.Tracks[0].ID).To(Equal("b1"))
			Expect(r.Tracks[0].Status).To(Equal("better"))
			Expect(r.Tracks[1].ID).To(Equal("c2"))
			Expect(r.Tracks[1].Status).To(Equal("added"))
			Expect(r.Tracks[2].ID).To(Equal("o3"))
			Expect(r.Tracks[2].Status).To(Equal("here"))
			Expect(r.Here).To(Equal(1))
			Expect(r.Better).To(Equal(1))
			Expect(r.Added).To(Equal(1))
			Expect(r.Ipods).To(Equal([]string{"iPod b1", "iPod c2"}))
		})

		It("keeps the album's own copy among equals", func() {
			own := model.MediaFiles{track(mp3("o1", 1, "One", 256), 1)}
			others := model.MediaFiles{track(mp3("b1", 2, "One", 256), 1)}
			r := completeAlbum(own, others)
			Expect(r.Tracks).To(HaveLen(1))
			Expect(r.Tracks[0].ID).To(Equal("o1"))
			Expect(r.Tracks[0].Status).To(Equal("here"))
			Expect(r.Ipods).To(BeEmpty())
		})

		It("matches placeholder titles by their position", func() {
			own := model.MediaFiles{track(mp3("o1", 1, "Track 01", 128), 1)}
			others := model.MediaFiles{track(mp3("b1", 2, "Track 01", 320), 1), track(mp3("b2", 2, "Track 02", 320), 2)}
			r := completeAlbum(own, others)
			Expect(r.Tracks).To(HaveLen(2))
			Expect(r.Tracks[0].Status).To(Equal("better"))
			Expect(r.Tracks[1].Status).To(Equal("added"))
		})
	})
})
