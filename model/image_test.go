package model_test

import (
	"os"
	"path/filepath"

	"github.com/navidrome/navidrome/conf"
	"github.com/navidrome/navidrome/conf/configtest"
	"github.com/navidrome/navidrome/consts"
	"github.com/navidrome/navidrome/model"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("Album covers in the data folder", func() {
	var dir string

	BeforeEach(func() {
		DeferCleanup(configtest.SetupConfig())
		conf.Server.DataFolder = GinkgoT().TempDir()
		dir = filepath.Join(conf.Server.DataFolder, consts.ArtworkFolder, consts.EntityAlbum)
	})

	write := func(name string) string {
		Expect(os.MkdirAll(dir, 0755)).To(Succeed())
		path := filepath.Join(dir, name)
		Expect(os.WriteFile(path, []byte("img"), 0600)).To(Succeed())
		return path
	}

	It("has no covers before the folder exists", func() {
		Expect(model.AlbumCoverPath("al-1", false)).To(BeEmpty())
		Expect(model.AlbumCoverKind("al-1")).To(BeEmpty())
	})

	It("tells covers set by an admin from covers found online", func() {
		manual := write("al-1.jpg")
		found := write("al-1.auto.png")
		write("al-2.auto.jpg")
		Expect(model.AlbumCoverPath("al-1", false)).To(Equal(manual))
		Expect(model.AlbumCoverPath("al-1", true)).To(Equal(found))
		Expect(model.AlbumCoverKind("al-1")).To(Equal("manual"))
		Expect(model.AlbumCoverKind("al-2")).To(Equal("auto"))
		Expect(model.AlbumCoverPath("al-2", false)).To(BeEmpty())
	})

	It("ignores covers still being written", func() {
		write("al-3.auto.jpg.tmp")
		Expect(model.AlbumCoverKind("al-3")).To(BeEmpty())
	})

	It("sees covers added and removed, recorded or not", func() {
		Expect(model.AlbumCoverKind("al-4")).To(BeEmpty())
		path := write("al-4.auto.jpg")
		model.RecordAlbumCover(path)
		Expect(model.AlbumCoverKind("al-4")).To(Equal("auto"))

		Expect(os.Remove(path)).To(Succeed())
		model.RecordAlbumCover(path)
		Expect(model.AlbumCoverKind("al-4")).To(BeEmpty())

		write("al-5.jpg") // Not recorded: found when the folder changes
		Expect(model.AlbumCoverKind("al-5")).To(Equal("manual"))
	})
})
