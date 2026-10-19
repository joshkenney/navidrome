package persistence

import (
	"context"

	"github.com/navidrome/navidrome/log"
	"github.com/navidrome/navidrome/model"
	"github.com/navidrome/navidrome/model/request"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"github.com/pocketbase/dbx"
)

var _ = Describe("Nested libraries", func() {
	const (
		parentID = 20 // "Music Library", holding every iPod's folder
		childID  = 21 // An iPod inside it
	)
	var (
		db   dbx.Builder
		repo model.LibraryRepository
	)

	exec := func(sql string, params dbx.Params) {
		_, err := db.NewQuery(sql).Bind(params).Execute()
		Expect(err).ToNot(HaveOccurred())
	}

	song := func(id string, libraryID int, path string) model.MediaFile {
		s := mf(model.MediaFile{ID: id, Title: "Nested " + id, Path: path, ArtistID: artistKraftwerk.ID, Artist: artistKraftwerk.Name})
		s.LibraryID = libraryID
		return s
	}

	BeforeEach(func() {
		db = GetDBXBuilder()
		ctx := request.WithUser(log.NewContext(context.TODO()), adminUser)
		repo = NewLibraryRepository(ctx, db)

		exec("INSERT INTO library (id, name, path) VALUES ({:id}, 'Nested Music', '/nested/music')", dbx.Params{"id": parentID})
		exec("INSERT INTO library (id, name, path) VALUES ({:id}, 'Nested iPod', '/nested/music/ipod-a/')", dbx.Params{"id": childID})

		mr := NewMediaFileRepository(ctx, db)
		for _, s := range []model.MediaFile{
			song("nested-p1", parentID, "ipod-a/Album/01 Song.mp3"),  // Copy of nested-c1
			song("nested-p2", parentID, "ipod-b/Album/01 Other.mp3"), // In a folder that is not a library
			song("nested-c1", childID, "Album/01 Song.mp3"),
		} {
			Expect(mr.Put(&s)).To(Succeed())
		}

		// The admin played and starred both copies, the regular user only the combined library's one
		exec(`INSERT INTO annotation (user_id, item_id, item_type, play_count, play_date, starred, starred_at, rating)
VALUES ({:admin}, 'nested-p1', 'media_file', 2, '2026-01-02 00:00:00', true, '2026-01-02 00:00:00', 3),
       ({:admin}, 'nested-c1', 'media_file', 3, '2026-01-01 00:00:00', false, NULL, 5),
       ({:regular}, 'nested-p1', 'media_file', 1, '2026-01-03 00:00:00', false, NULL, 4)`,
			dbx.Params{"admin": adminUser.ID, "regular": regularUser.ID})
		exec("INSERT INTO playlist (id, name, owner_id) VALUES ('nested-pls', 'Nested', {:admin})", dbx.Params{"admin": adminUser.ID})
		exec("INSERT INTO playlist_tracks (id, playlist_id, media_file_id) VALUES (1, 'nested-pls', 'nested-p1')", nil)
		exec("INSERT INTO scrobbles (media_file_id, user_id, submission_time) VALUES ('nested-p1', {:admin}, 1)", dbx.Params{"admin": adminUser.ID})
		exec("INSERT INTO playqueue (id, user_id, items) VALUES ('nested-pq', {:regular}, 'nested-p2,nested-p1')", dbx.Params{"regular": regularUser.ID})
		exec("INSERT INTO share (id, user_id, resource_ids, resource_type) VALUES ('nested-share', {:admin}, 'nested-p1', 'media_file')", dbx.Params{"admin": adminUser.ID})

		DeferCleanup(func() {
			for _, q := range []string{
				"DELETE FROM share WHERE id = 'nested-share'",
				"DELETE FROM playqueue WHERE id = 'nested-pq'",
				"DELETE FROM scrobbles WHERE media_file_id LIKE 'nested-%'",
				"DELETE FROM playlist WHERE id = 'nested-pls'",
				"DELETE FROM annotation WHERE item_id LIKE 'nested-%'",
				"DELETE FROM media_file WHERE id LIKE 'nested-%'",
				"DELETE FROM user_library WHERE library_id IN (20, 21)",
				"DELETE FROM library WHERE id IN (20, 21)",
			} {
				_, _ = db.NewQuery(q).Execute()
			}
		})
	})

	Describe("MergeNestedLibraries", func() {
		type annotation struct {
			PlayCount int    `db:"play_count"`
			PlayDate  string `db:"play_date"`
			Starred   bool   `db:"starred"`
			Rating    int    `db:"rating"`
		}
		annotationOf := func(userID, itemID string) *annotation {
			var a annotation
			err := db.NewQuery("SELECT play_count, coalesce(play_date, '') AS play_date, starred, rating FROM annotation " +
				"WHERE user_id = {:user} AND item_id = {:item} AND item_type = 'media_file'").
				Bind(dbx.Params{"user": userID, "item": itemID}).One(&a)
			if err != nil {
				return nil
			}
			return &a
		}
		value := func(sql string) string {
			var v struct {
				V string `db:"v"`
			}
			Expect(db.NewQuery(sql).One(&v)).To(Succeed())
			return v.V
		}

		BeforeEach(func() {
			merged, err := repo.MergeNestedLibraries()
			Expect(err).ToNot(HaveOccurred())
			Expect(merged).To(Equal(1))
		})

		It("replaces the combined library's copy with the nested library's one", func() {
			Expect(value("SELECT group_concat(id) AS v FROM media_file WHERE id LIKE 'nested-%' ORDER BY id")).
				To(SatisfyAll(ContainSubstring("nested-c1"), ContainSubstring("nested-p2"), Not(ContainSubstring("nested-p1"))))
		})

		It("combines annotations of users who annotated both copies", func() {
			Expect(annotationOf(adminUser.ID, "nested-p1")).To(BeNil())
			a := annotationOf(adminUser.ID, "nested-c1")
			Expect(a).ToNot(BeNil())
			Expect(a.PlayCount).To(Equal(5))
			Expect(a.PlayDate).To(HavePrefix("2026-01-02"))
			Expect(a.Starred).To(BeTrue())
			Expect(a.Rating).To(Equal(5))
		})

		It("moves annotations of users who only annotated the combined library's copy", func() {
			a := annotationOf(regularUser.ID, "nested-c1")
			Expect(a).ToNot(BeNil())
			Expect(a.PlayCount).To(Equal(1))
			Expect(a.Rating).To(Equal(4))
		})

		It("keeps playlists, scrobbles, play queues and shares", func() {
			Expect(value("SELECT media_file_id AS v FROM playlist_tracks WHERE playlist_id = 'nested-pls'")).To(Equal("nested-c1"))
			Expect(value("SELECT media_file_id AS v FROM scrobbles WHERE user_id = '" + adminUser.ID + "' AND submission_time = 1")).To(Equal("nested-c1"))
			Expect(value("SELECT items AS v FROM playqueue WHERE id = 'nested-pq'")).To(Equal("nested-p2,nested-c1"))
			Expect(value("SELECT resource_ids AS v FROM share WHERE id = 'nested-share'")).To(Equal("nested-c1"))
		})

		It("has nothing left to merge afterwards", func() {
			merged, err := repo.MergeNestedLibraries()
			Expect(err).ToNot(HaveOccurred())
			Expect(merged).To(BeZero())
		})
	})

	Describe("SyncNestedAccess", func() {
		It("gives users of the combined library access to the libraries inside it", func() {
			ur := NewUserRepository(request.WithUser(context.TODO(), adminUser), db)
			Expect(ur.SetUserLibraries(regularUser.ID, []int{1, parentID})).To(Succeed())
			DeferCleanup(func() { _ = ur.SetUserLibraries(regularUser.ID, []int{1}) })

			libs, err := ur.GetUserLibraries(regularUser.ID)
			Expect(err).ToNot(HaveOccurred())
			Expect(libs.IDs()).To(ContainElements(1, parentID, childID))
		})
	})
})
