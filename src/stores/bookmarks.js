import { defineStore } from 'pinia'
import { db } from '@/lib/db'
import { BookmarkAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Bookmarks store — offline-first (PRD §4.1 / §7.4).
 *
 * Dexie is the source of truth; views use liveQuery() for reactivity.
 * This store owns all write operations and the API sync layer.
 */
export const useBookmarksStore = defineStore('bookmarks', {
  state: () => ({
    syncing: false,
    error: null
  }),

  actions: {
    /** Pull all bookmarks from the API and upsert into Dexie. */
    async fetchFromApi() {
      this.syncing = true
      this.error = null
      try {
        const { data } = await BookmarkAPI.list()
        await db.transaction('rw', db.bookmarks, async () => {
          for (const remote of data) {
            const existing = await db.bookmarks.where({ remoteId: remote.id }).first()
            if (existing) {
              if (!existing.dirty) {
                await db.bookmarks.update(existing.localId, {
                  book: remote.book,
                  chapter: remote.chapter,
                  verse: remote.verse ?? null,
                  label: remote.label ?? null,
                  updatedAt: remote.updated_at,
                  dirty: false
                })
              }
            } else {
              await db.bookmarks.add({
                remoteId: remote.id,
                userId: remote.user_id,
                book: remote.book,
                chapter: remote.chapter,
                verse: remote.verse ?? null,
                label: remote.label ?? null,
                updatedAt: remote.updated_at,
                dirty: false
              })
            }
          }
        })
      } catch (err) {
        this.error = err?.response?.data?.message ?? err.message
      } finally {
        this.syncing = false
      }
    },

    /**
     * Create a bookmark locally, then push to server.
     * Idempotent on the server side (unique constraint on user+book+chapter+verse).
     */
    async create(payload) {
      const auth = useAuthStore()

      // Check for a local duplicate first
      const duplicate = await db.bookmarks
        .where({ book: payload.book, chapter: payload.chapter, verse: payload.verse ?? null })
        .first()
      if (duplicate) return duplicate.localId

      const localId = await db.bookmarks.add({
        remoteId: null,
        userId: auth.user?.id ?? 'local',
        book: payload.book,
        chapter: payload.chapter,
        verse: payload.verse ?? null,
        label: payload.label ?? null,
        updatedAt: new Date().toISOString(),
        dirty: true
      })

      await db.syncQueue.add({
        entityType: 'bookmark',
        entityLocalId: localId,
        action: 'create',
        createdAt: new Date().toISOString(),
        attempts: 0
      })

      try {
        const { data } = await BookmarkAPI.create(payload)
        await db.bookmarks.update(localId, { remoteId: data.id, dirty: false })
        await db.syncQueue.where({ entityType: 'bookmark', entityLocalId: localId }).delete()
      } catch {
        // Offline — syncService retries
      }

      return localId
    },

    /** Delete a bookmark by its Dexie localId. */
    async remove(localId) {
      const bookmark = await db.bookmarks.get(localId)
      await db.bookmarks.delete(localId)

      if (bookmark?.remoteId) {
        try {
          await BookmarkAPI.destroy(bookmark.remoteId)
        } catch {
          await db.syncQueue.add({
            entityType: 'bookmark',
            entityLocalId: localId,
            action: 'delete',
            createdAt: new Date().toISOString(),
            attempts: 0
          })
        }
      }
    }
  }
})
