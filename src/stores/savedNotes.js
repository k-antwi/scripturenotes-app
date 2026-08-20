import { defineStore } from 'pinia'
import { db } from '@/lib/db'
import { useAuthStore } from '@/stores/auth'

/**
 * savedNotes store — manages explicitly named study notes (Notes tab).
 *
 * A savedNote is a named collection that can hold passages from anywhere in
 * the Bible. When the user taps "Save Note" in the reader they either create
 * a new note or append the current passage to an existing one.
 *
 * Offline-first: all writes land in Dexie immediately (dirty: true).
 *
 * Tables used:
 *  - db.savedNotes       — one row per named note
 *  - db.savedNotePassages — one row per (note × passage) pair
 */
export const useSavedNotesStore = defineStore('savedNotes', {
  state: () => ({
    saving: false,
    error: null
  }),

  actions: {
    /**
     * Create a brand-new named note and record the first passage under it.
     *
     * @param {object} payload
     * @param {string} payload.name           – user-supplied note name (non-empty)
     * @param {string} payload.book           – e.g. 'PRO'
     * @param {number} payload.chapter        – e.g. 19
     * @param {string} payload.passageRef     – human label, e.g. 'Proverbs 19'
     * @param {number} [payload.annotationCount]
     * @returns {Promise<number>} localId of the new savedNote row
     */
    async save({ name, book, chapter, passageRef, annotationCount = 0 }) {
      const auth = useAuthStore()
      const trimmedName = name.trim()
      if (!trimmedName) throw new Error('Note name cannot be empty.')

      this.saving = true
      this.error = null
      try {
        const now = new Date().toISOString()

        // Create the note header
        const savedNoteLocalId = await db.savedNotes.add({
          remoteId: null,
          userId: auth.user?.id ?? 'local',
          name: trimmedName,
          createdAt: now,
          updatedAt: now,
          dirty: true
        })

        // Record the first passage entry
        await db.savedNotePassages.add({
          savedNoteLocalId,
          book,
          chapter,
          passageRef,
          annotationCount,
          savedAt: now
        })

        return savedNoteLocalId
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.saving = false
      }
    },

    /**
     * Add a passage to an existing saved note.
     * If the passage (same book + chapter) is already linked to this note it is
     * updated in place (annotation count refreshed, savedAt bumped) rather than
     * creating a duplicate row.
     *
     * @param {number} savedNoteLocalId  – localId of the target note
     * @param {object} passage
     * @param {string} passage.book
     * @param {number} passage.chapter
     * @param {string} passage.passageRef
     * @param {number} [passage.annotationCount]
     */
    async addPassage(savedNoteLocalId, { book, chapter, passageRef, annotationCount = 0 }) {
      const now = new Date().toISOString()

      // Guard: check for an existing row for this (note, passage) pair
      const existing = await db.savedNotePassages
        .where('[savedNoteLocalId+book+chapter]')
        .equals([savedNoteLocalId, book, chapter])
        .first()

      if (existing) {
        // Refresh annotation count and timestamp rather than adding a duplicate
        await db.savedNotePassages.update(existing.localId, { annotationCount, savedAt: now })
      } else {
        await db.savedNotePassages.add({
          savedNoteLocalId,
          book,
          chapter,
          passageRef,
          annotationCount,
          savedAt: now
        })
      }

      // Bump the note's updatedAt so the list re-sorts correctly
      await db.savedNotes.update(savedNoteLocalId, { updatedAt: now, dirty: true })
    },

    /** Rename an existing saved note. */
    async rename(localId, newName) {
      const trimmedName = newName.trim()
      if (!trimmedName) throw new Error('Note name cannot be empty.')
      await db.savedNotes.update(localId, {
        name: trimmedName,
        updatedAt: new Date().toISOString(),
        dirty: true
      })
    },

    /**
     * Delete a saved note and all its passage entries.
     * @param {number} localId – savedNote localId
     */
    async remove(localId) {
      await db.savedNotePassages.where({ savedNoteLocalId: localId }).delete()
      await db.savedNotes.delete(localId)
    }
  }
})
