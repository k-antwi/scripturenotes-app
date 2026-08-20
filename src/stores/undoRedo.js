import { defineStore } from 'pinia'
import { db } from '@/lib/db'

/**
 * Undo / Redo stack for annotation mutations (PRD Phase 3 — Extended Annotations).
 *
 * Design: we track localIds only. Undo a "create" by restoring the annotation
 * (clearing deletedAt); undo a "remove" by soft-deleting it again.  This keeps
 * the same Dexie localId throughout rather than re-creating rows.
 *
 * The stack is scoped to the current reading session — it is cleared whenever
 * the user navigates to a different passage.
 */
export const useUndoRedoStore = defineStore('undoRedo', {
  state: () => ({
    /** @type {Array<{op: 'create'|'remove', localId: number}>} */
    past: [],
    /** @type {Array<{op: 'create'|'remove', localId: number}>} */
    future: []
  }),

  getters: {
    canUndo: (state) => state.past.length > 0,
    canRedo: (state) => state.future.length > 0
  },

  actions: {
    /** Call immediately after AnnotationRepository.create() returns a localId. */
    recordCreate(localId) {
      this.past.push({ op: 'create', localId })
      this.future = []
    },

    /** Call immediately after AnnotationRepository.remove() to allow re-surfacing. */
    recordRemove(localId) {
      this.past.push({ op: 'remove', localId })
      this.future = []
    },

    async undo() {
      const entry = this.past.pop()
      if (!entry) return
      this.future.push(entry)

      if (entry.op === 'create') {
        // Undo a create → soft-delete the annotation
        await db.annotations.update(entry.localId, {
          deletedAt: new Date().toISOString(),
          dirty: true
        })
        await _enqueue('annotation', entry.localId, 'delete')
      } else if (entry.op === 'remove') {
        // Undo a remove → restore the annotation
        await db.annotations.update(entry.localId, {
          deletedAt: null,
          dirty: true,
          updatedAt: new Date().toISOString()
        })
        await _enqueue('annotation', entry.localId, 'update')
      }
    },

    async redo() {
      const entry = this.future.pop()
      if (!entry) return
      this.past.push(entry)

      if (entry.op === 'create') {
        // Redo a create → restore (un-delete) the annotation
        await db.annotations.update(entry.localId, {
          deletedAt: null,
          dirty: true,
          updatedAt: new Date().toISOString()
        })
        await _enqueue('annotation', entry.localId, 'update')
      } else if (entry.op === 'remove') {
        // Redo a remove → soft-delete again
        await db.annotations.update(entry.localId, {
          deletedAt: new Date().toISOString(),
          dirty: true
        })
        await _enqueue('annotation', entry.localId, 'delete')
      }
    },

    /** Clear both stacks when navigating to a new passage. */
    clear() {
      this.past = []
      this.future = []
    }
  }
})

/** Mirror of AnnotationRepository._enqueue — keeps the outbox in sync. */
async function _enqueue(entityType, entityLocalId, action) {
  await db.syncQueue.add({
    entityType,
    entityLocalId,
    action,
    createdAt: new Date().toISOString(),
    attempts: 0
  })
}
