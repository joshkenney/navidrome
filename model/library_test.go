package model_test

import (
	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Library", func() {
	lib := func(id int, path string) model.Library { return model.Library{ID: id, Path: path} }

	Describe("Contains", func() {
		It("is true for libraries inside the library's folder", func() {
			Expect(lib(1, "/music").Contains(lib(2, "/music/alice"))).To(BeTrue())
			Expect(lib(1, "/music/").Contains(lib(2, "/music/bob/"))).To(BeTrue())
			Expect(lib(1, "/").Contains(lib(2, "/music"))).To(BeTrue())
		})

		It("is false for other folders, even with the same name prefix", func() {
			Expect(lib(1, "/music/ipod").Contains(lib(2, "/music/ipod2"))).To(BeFalse())
			Expect(lib(1, "/music").Contains(lib(2, "/other"))).To(BeFalse())
			Expect(lib(1, "/music/alice").Contains(lib(2, "/music"))).To(BeFalse())
			Expect(lib(1, "/music").Contains(lib(1, "/music"))).To(BeFalse())
		})
	})

	Describe("Nested and Combined", func() {
		libs := model.Libraries{lib(1, "/music"), lib(2, "/music/alice"), lib(3, "/music/bob"), lib(4, "/other")}

		It("finds the libraries inside a library", func() {
			Expect(libs.Nested(libs[0]).IDs()).To(Equal([]int{2, 3}))
			Expect(libs.Nested(libs[1])).To(BeEmpty())
		})

		It("finds the libraries that contain others", func() {
			Expect(libs.Combined().IDs()).To(Equal([]int{1}))
		})
	})
})
