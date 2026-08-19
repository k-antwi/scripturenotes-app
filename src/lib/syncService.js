import { Network } from '@capacitor/network'
import { db } from './db'
import { AnnotationAPI } from './api'
import { useSyncStore } from '@/stores/sync'

const SYNC_INTERVAL_MS = Number(import.meta.env.VITE_SYNC_INTERVAL_MS ?? 5000)
let intervalHandle = null

/**
 * Drains the `syncQueue` outbox to Laravel in a single batched call
 * (PRD §9 Scalability: "at most 1 call per 5 seconds of drawing activity"),
 * then marks synced rows clean. Runs on an interval and whenever
 * connectivity is regained (PRD §5.4 offline indicator / sync).
 */
export async function flushOutbox() {
  const status = await Network.getStatus()
  if (!status.connected) return

  const pending = await db.syncQueue.orderBy('createdAt').limit(50).toArray()
  if (pending.length === 0) return

  const annotationMutations = []
  for (const item of pending) {
    if (item.entityType !== 'annotation') continue
    const record = await db.annotations.get(item.entityLocalId)
    if (!record) continue
    annotationMutations.push({
      localId: record.localId,
      remoteId: record.remoteId,
      action: item.action,
      book: record.book,
      chapter: record.chapter,
      verse: record.verse,
      type: record.type,
      data: record.data,
      colour: record.colour,
      isShared: record.isShared,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt
    })
  }

  if (annotationMutations.length === 0) return

  try {
    const { data } = await AnnotationAPI.sync(annotationMutations)

    // Server echoes back { localId, remoteId } pairs so we can reconcile
    // client-generated IDs with authoritative ones.
    await db.transaction('rw', db.annotations, db.syncQueue, async () => {
      for (const result of data.results ?? []) {
        await db.annotations.update(result.localId, {
          remoteId: result.remoteId,
          dirty: false
        })
      }
      const processedIds = pending
        .filter((p) => annotationMutations.some((m) => m.localId === p.entityLocalId))
        .map((p) => p.id)
      await db.syncQueue.bulkDelete(processedIds)
    })
  } catch (err) {
    // Conflict resolution per PRD §5.4 / §9 Data Integrity:
    // Last-Write-Wins for pen strokes, merge for non-overlapping highlights.
    // A 409 from the server means the user needs to choose a version.
    if (err.response?.status === 409) {
      await handleSyncConflict(err.response.data)
    } else {
      // Leave the outbox intact; bump attempts and retry next tick.
      await Promise.all(
        pending.map((p) => db.syncQueue.update(p.id, { attempts: (p.attempts ?? 0) + 1 }))
      )
    }
  }
}

async function handleSyncConflict(conflictPayload) {
  // Surfaced to the UI via a Pinia store so the user can pick
  // "keep local" or "keep remote" (PRD §9 Data Integrity).
  useSyncStore().registerConflict(conflictPayload)
}

export function startSyncLoop() {
  flushOutbox()
  intervalHandle = setInterval(flushOutbox, SYNC_INTERVAL_MS)
  Network.addListener('networkStatusChange', (status) => {
    if (status.connected) flushOutbox()
  })
}

export function stopSyncLoop() {
  if (intervalHandle) clearInterval(intervalHandle)
}
