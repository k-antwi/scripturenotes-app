import { defineStore } from 'pinia'
import { db } from '@/lib/db'
import { NotebookAPI } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'

/**
 * Notebooks store — offline-first (PRD §4.1).
 *
 * Dexie is the source of truth for UI reads; views use liveQuery() directly
 * for reactivity.  This store owns all write operations and the sync layer:
 *  - Writes always land in Dexie first (dirty:true)
 *  - fetchFromApi() hydrates Dexie from the server (called on app resume or login)
 *  - syncQueue entries are created here; syncService flushes them in background
 */
export const useNotebooksStore = defineStore('notebooks', {
  state: () => ({
    syncing: false,
    error: null
  }),

  actions: {
    /** Pull all notebooks from the API and upsert them into Dexie. */
    async fetchFromApi() {
      this.syncing = true
      this.error = null
      try {
        const { data } = await NotebookAPI.list()
        await db.transaction('rw', db.notebooks, async () => {
          for (const remote of data) {
            const existing = await db.notebooks.where({ remoteId: remote.id }).first()
            if (existing) {
              // Only overwrite if local copy isn't dirty (don't clobber offline edits)
              if (!existing.dirty) {
                await db.notebooks.update(existing.localId, {
                  title: remote.title,
                  description: remote.description ?? null,
                  updatedAt: remote.updated_at,
                  dirty: false
                })
              }
            } else {
              await db.notebooks.add({
                remoteId: remote.id,
                userId: remote.user_id,
                title: remote.title,
                description: remote.description ?? null,
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

    /** Create a notebook locally, then queue it for server sync. */
    async create(payload) {
      const auth = useAuthStore()
      const localId = await db.notebooks.add({
        remoteId: null,
        userId: auth.user?.id ?? 'local',
        title: payload.title.trim(),
        description: payload.description ?? null,
        updatedAt: new Date().toISOString(),
        dirty: true
      })

      await db.syncQueue.add({
        entityType: 'notebook',
        entityLocalId: localId,
        action: 'create',
        createdAt: new Date().toISOString(),
        attempts: 0
      })

      // Optimistic: try to push immediately if online
      try {
        const { data } = await NotebookAPI.create({
          title: payload.title.trim(),
          description: payload.description ?? null
        })
        await db.notebooks.update(localId, { remoteId: data.id, dirty: false })
        await db.syncQueue.where({ entityType: 'notebook', entityLocalId: localId }).delete()
      } catch {
        // Offline — syncService will retry
      }

      return localId
    },

    /** Update a notebook locally and push to server. */
    async update(localId, payload) {
      await db.notebooks.update(localId, {
        ...payload,
        updatedAt: new Date().toISOString(),
        dirty: true
      })

      const notebook = await db.notebooks.get(localId)
      if (!notebook?.remoteId) return

      try {
        await NotebookAPI.update(notebook.remoteId, payload)
        await db.notebooks.update(localId, { dirty: false })
      } catch {
        await db.syncQueue.add({
          entityType: 'notebook',
          entityLocalId: localId,
          action: 'update',
          createdAt: new Date().toISOString(),
          attempts: 0
        })
      }
    },

    /** Delete a notebook locally and queue server removal. */
    async remove(localId) {
      const notebook = await db.notebooks.get(localId)

      // Remove pivot rows
      await db.annotationNotebook.where({ notebookLocalId: localId }).delete()
      await db.notebooks.delete(localId)

      if (notebook?.remoteId) {
        try {
          await NotebookAPI.destroy(notebook.remoteId)
        } catch {
          await db.syncQueue.add({
            entityType: 'notebook',
            entityLocalId: localId,
            action: 'delete',
            createdAt: new Date().toISOString(),
            attempts: 0
          })
        }
      }
    },

    /** Attach an annotation to a notebook (by local IDs). */
    async addAnnotation(notebookLocalId, annotationLocalId) {
      const existing = await db.annotationNotebook
        .where({ notebookLocalId, annotationLocalId })
        .first()
      if (existing) return

      await db.annotationNotebook.add({
        notebookLocalId,
        annotationLocalId,
        dirty: true
      })

      const [notebook, annotation] = await Promise.all([
        db.notebooks.get(notebookLocalId),
        db.annotations.get(annotationLocalId)
      ])

      if (notebook?.remoteId && annotation?.remoteId) {
        try {
          await NotebookAPI.addAnnotation(notebook.remoteId, annotation.remoteId)
          await db.annotationNotebook
            .where({ notebookLocalId, annotationLocalId })
            .modify({ dirty: false })
        } catch {
          // Will sync later
        }
      }
    },

    /** Detach an annotation from a notebook (by local IDs). */
    async removeAnnotation(notebookLocalId, annotationLocalId) {
      await db.annotationNotebook
        .where({ notebookLocalId, annotationLocalId })
        .delete()

      const [notebook, annotation] = await Promise.all([
        db.notebooks.get(notebookLocalId),
        db.annotations.get(annotationLocalId)
      ])

      if (notebook?.remoteId && annotation?.remoteId) {
        try {
          await NotebookAPI.removeAnnotation(notebook.remoteId, annotation.remoteId)
        } catch {
          // Tolerate — the pivot row is already gone locally
        }
      }
    }
  }
})
