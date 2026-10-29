package nativeapi

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("tribeEssentials", func() {
	// iPods 10, 11, 12 are tribe 0; 20, 21 are tribe 1; 30 is a free spirit
	ipodIDs := []int{10, 11, 12, 20, 21, 30}
	tribes := ipodTribes{
		tribes: []ipodTribe{{ID: 0}, {ID: 1}},
		byIpod: map[int]int{10: 0, 11: 0, 12: 0, 20: 1, 21: 1, 30: -1},
	}
	song := func(id string, artist int32, ipods ...int32) radioSong {
		return radioSong{rep: id, artist: artist, ipods: ipods}
	}

	It("picks the songs a tribe shares and the others don't have", func() {
		idx := &radioIndex{songs: []radioSong{
			song("everywhere", 0, 0, 1, 2, 3, 4, 5),
			song("tribe0-all", 1, 0, 1, 2),
			song("tribe0-two", 2, 0, 1),
			song("tribe0-leaky", 3, 0, 1, 2, 3, 4),
			song("tribe1-both", 4, 3, 4),
			song("alone", 5, 0),
		}}
		e := tribeEssentials(idx, tribes, ipodIDs)
		// "tribe0-leaky" is on every tribe iPod, but also on most others
		Expect(e[0]).To(Equal([]string{"tribe0-all", "tribe0-two"}))
		Expect(e[1]).To(Equal([]string{"tribe1-both"}))
		Expect(e).ToNot(HaveKey(-1))
	})

	It("leaves out spoken word, and keeps each artist to a few songs", func() {
		podcast := song("podcast", 9, 0, 1, 2)
		podcast.spoken = true
		idx := &radioIndex{songs: []radioSong{
			podcast,
			song("a1", 1, 0, 1, 2), song("a2", 1, 0, 1, 2), song("a3", 1, 0, 1, 2),
			song("b1", 2, 0, 1),
		}}
		e := tribeEssentials(idx, tribes, ipodIDs)
		Expect(e[0]).To(Equal([]string{"a1", "a2", "b1"}))
	})
})
