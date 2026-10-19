package subsonic

import (
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("ipodDownloadID", func() {
	It("recognizes downloads of a whole iPod", func() {
		id, ok := ipodDownloadID("ipod-12")
		Expect(ok).To(BeTrue())
		Expect(id).To(Equal(12))
	})

	It("ignores other ids", func() {
		_, ok := ipodDownloadID("al-123")
		Expect(ok).To(BeFalse())
		_, ok = ipodDownloadID("ipod-abc")
		Expect(ok).To(BeFalse())
	})
})
