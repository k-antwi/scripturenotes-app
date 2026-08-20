import { ref, watch, onUnmounted } from 'vue'
import { db } from '@/lib/db'
import { useAuthStore } from '@/stores/auth'

/**
 * Records and updates a `studySessions` row in Dexie while the reader is
 * open, matching the `study_sessions` table in PRD §4.2.
 * Call once inside ScriptureReader or ReaderView.
 */
export function useStudySession(passageRefGetter) {
  const auth = useAuthStore()
  const sessionId = ref(null)

  async function startSession(passageRef) {
    // History is a user-owned feature — no point recording sessions that can
    // never be viewed (guests have no /history route access, PRD §5.5).
    if (!auth.isAuthenticated) return

    const now = new Date().toISOString()
    const today = now.slice(0, 10) // 'YYYY-MM-DD'

    // Reuse an existing session for the same passage opened today so that
    // revisiting the same chapter multiple times within a day produces only
    // one History entry instead of a growing list of duplicates.
    const existing = await db.studySessions
      .where('passageRef')
      .equals(passageRef)
      .filter((s) => typeof s.startedAt === 'string' && s.startedAt.slice(0, 10) === today)
      .first()

    if (existing) {
      sessionId.value = existing.localId
      await db.studySessions.update(existing.localId, { lastActiveAt: now })
      return
    }

    sessionId.value = await db.studySessions.add({
      remoteId: null,
      userId: auth.user?.id ?? 'local',
      startedAt: now,
      lastActiveAt: now,
      passageRef
    })
  }

  async function pingSession() {
    if (!auth.isAuthenticated || !sessionId.value) return
    await db.studySessions.update(sessionId.value, {
      lastActiveAt: new Date().toISOString()
    })
  }

  watch(
    passageRefGetter,
    (ref) => {
      if (ref) startSession(ref)
    },
    { immediate: true }
  )

  // Ping every 30 seconds to track how long the session lasted
  const pingHandle = setInterval(pingSession, 30_000)
  onUnmounted(() => clearInterval(pingHandle))

  return { sessionId }
}
