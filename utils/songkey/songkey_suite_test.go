package songkey

import (
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestSongKey(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "SongKey Suite")
}
