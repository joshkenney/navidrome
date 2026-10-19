package nativeapi

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	"github.com/navidrome/navidrome/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

// slowIpodRepo is a small iPod repository that takes a while to load, and counts the loads
type slowIpodRepo struct {
	model.IpodRepository
	version atomic.Value
	loads   atomic.Int32
	delay   time.Duration
}

func (r *slowIpodRepo) DataVersion() (string, error) { return r.version.Load().(string), nil }
func (r *slowIpodRepo) Stats() ([]model.IpodStats, error) {
	r.loads.Add(1)
	time.Sleep(r.delay)
	return []model.IpodStats{{LibraryID: 1, Name: "iPod", SongCount: int(r.loads.Load())}}, nil
}
func (r *slowIpodRepo) ArtistCounts() ([]model.IpodArtistCount, error) { return nil, nil }
func (r *slowIpodRepo) Totals() (*model.IpodTotals, error)             { return &model.IpodTotals{}, nil }
func (r *slowIpodRepo) SongIndex() ([]model.IpodSongEntry, error)      { return nil, nil }
func (r *slowIpodRepo) GenreCounts() ([]model.IpodGenreCount, error)   { return nil, nil }

var _ = Describe("iPod data cache", func() {
	var api *Router
	var repo *slowIpodRepo
	ctx := request.WithUser(context.Background(), model.User{ID: "u", IsAdmin: true})

	BeforeEach(func() {
		ipodDataCache.entries = map[string]*ipodCacheEntry{}
		repo = &slowIpodRepo{delay: 100 * time.Millisecond}
		repo.version.Store("1|scan-1|")
		api = &Router{ds: &tests.MockDataStore{MockedIpod: repo, MockedProperty: &tests.MockedPropertyRepo{}}}
	})

	It("loads the data once, even for concurrent requests", func() {
		var wg sync.WaitGroup
		for range 5 {
			wg.Add(1)
			go func() {
				defer GinkgoRecover()
				defer wg.Done()
				d, err := api.loadIpodData(ctx)
				Expect(err).ToNot(HaveOccurred())
				Expect(d.stats).To(HaveLen(1))
			}()
		}
		wg.Wait()
		Expect(repo.loads.Load()).To(Equal(int32(1)))
	})

	It("serves the old data right away while newer data loads in the background", func() {
		first, err := api.loadIpodData(ctx)
		Expect(err).ToNot(HaveOccurred())

		repo.version.Store("1|scan-2|") // A scan finished
		start := time.Now()
		again, err := api.loadIpodData(ctx)
		Expect(err).ToNot(HaveOccurred())
		Expect(time.Since(start)).To(BeNumerically("<", repo.delay), "did not wait for the reload")
		Expect(again).To(BeIdenticalTo(first))

		Eventually(func() string {
			d, _ := api.loadIpodData(ctx)
			return d.version
		}).Should(Equal("1|scan-2|"))
		Expect(repo.loads.Load()).To(Equal(int32(2)))
	})

	It("keeps separate data for users who can access different iPods", func() {
		_, _ = api.loadIpodData(ctx)
		repo.version.Store("1,2|scan-1|")
		_, _ = api.loadIpodData(ctx)
		Expect(ipodDataCache.entries).To(HaveLen(2))
	})
})
