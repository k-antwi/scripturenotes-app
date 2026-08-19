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
    const now = new Date().toISOString()
    sessionId.value = await db.studySessions.add({
      remoteId: null,
      userId: auth.user?.id ?? 'local',
      startedAt: now,
      lastActiveAt: now,
      passageRef
    })
  }

  async function pingSession() {
    if (!sessionId.value) return
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
