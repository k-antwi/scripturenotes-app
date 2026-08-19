import { defineStore } from 'pinia'
import { db } from '@/lib/db'

/**
 * Surfaces sync conflicts to the UI so the user can choose which version
 * wins (PRD §9 Data Integrity: "User is notified of any sync conflict
 * with options to keep local or remote version").
 */
export const useSyncStore = defineStore('sync', {
  state: () => ({
    isOnline: true,
    pendingCount: 0,
    conflicts: [] // [{ localId, local, remote }]
  }),
  actions: {
    registerConflict(payload) {
      this.conflicts.push(payload)
    },
    async resolveConflict(localId, keep /* 'local' | 'remote' */) {
      const conflict = this.conflicts.find((c) => c.localId === localId)
      if (!conflict) return
      if (keep === 'remote') {
        await db.annotations.update(localId, { ...conflict.remote, dirty: false })
      } else {
        await db.annotations.update(localId, { dirty: true })
      }
      this.conflicts = this.conflicts.filter((c) => c.localId !== localId)
    },
    async refreshPendingCount() {
      this.pendingCount = await db.syncQueue.count()
    }
  }
})
