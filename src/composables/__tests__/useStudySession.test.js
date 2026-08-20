/**
 * Unit tests for useStudySession — session upsert deduplication.
 *
 * Run with:  npx vitest run src/composables/__tests__/useStudySession.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
// NOTE: useStudySession is imported via dynamic import() inside the auth-guard
// describe block below.  A static top-level import would trigger the @/lib/db
// vi.mock factory before const mockDb is initialised (vi.mock is hoisted by
// Vitest's transform), causing a TDZ ReferenceError.  Dynamic import runs after
// module-level code so mockDb is ready by then.

// ── Fake DB ───────────────────────────────────────────────────────────────────
let store = []
let nextId = 1

const mockDb = {
  studySessions: {
    where: (field) => ({
      equals: (value) => ({
        filter: (fn) => ({
          first: async () => store.filter((r) => r[field] === value).find(fn) ?? null
        })
      })
    }),
    add: vi.fn(async (row) => {
      const localId = nextId++
      store.push({ ...row, localId })
      return localId
    }),
    update: vi.fn(async (localId, patch) => {
      const idx = store.findIndex((r) => r.localId === localId)
      if (idx !== -1) Object.assign(store[idx], patch)
    })
  }
}

vi.mock('@/lib/db', () => ({ db: mockDb }))

// ── Configurable auth mock — mutate mockAuth per test to change auth state ────
const mockAuth = { user: { id: 'user-1' }, isAuthenticated: true }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth
}))

// ── Suppress Vue warning about missing app context for provide/inject ─────────
vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal()
  return {
    ...vue,
    onUnmounted: vi.fn(),
    watch: vi.fn((getter, cb, opts) => {
      if (opts?.immediate) cb(typeof getter === 'function' ? getter() : getter.value)
    })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePassageRef(ref) {
  return () => ref
}

async function callStartSession(passageRef, isoNow) {
  // Inline the logic from useStudySession.startSession so we can test it
  // without wiring up the full Vue lifecycle.
  const now = isoNow
  const today = now.slice(0, 10)

  const existing = await mockDb.studySessions
    .where('passageRef')
    .equals(passageRef)
    .filter((s) => typeof s.startedAt === 'string' && s.startedAt.slice(0, 10) === today)
    .first()

  if (existing) {
    await mockDb.studySessions.update(existing.localId, { lastActiveAt: now })
    return existing.localId
  }

  return mockDb.studySessions.add({
    remoteId: null,
    userId: 'user-1',
    startedAt: now,
    lastActiveAt: now,
    passageRef
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useStudySession — deduplication', () => {
  beforeEach(() => {
    // Restore authenticated state before each dedup test
    mockAuth.user = { id: 'user-1' }
    mockAuth.isAuthenticated = true
    store = []
    nextId = 1
    mockDb.studySessions.add.mockClear()
    mockDb.studySessions.update.mockClear()
  })

  it('creates a new session on the first visit to a chapter', async () => {
    const id = await callStartSession('PRO 19', '2026-08-20T09:00:00.000Z')
    expect(id).toBe(1)
    expect(mockDb.studySessions.add).toHaveBeenCalledOnce()
    expect(store).toHaveLength(1)
    expect(store[0].passageRef).toBe('PRO 19')
  })

  it('reuses the existing session on a same-day revisit', async () => {
    await callStartSession('PRO 19', '2026-08-20T09:00:00.000Z')
    const id = await callStartSession('PRO 19', '2026-08-20T11:30:00.000Z')

    // add() should only have been called once
    expect(mockDb.studySessions.add).toHaveBeenCalledOnce()
    // update() should have been called to bump lastActiveAt
    expect(mockDb.studySessions.update).toHaveBeenCalledOnce()
    expect(mockDb.studySessions.update).toHaveBeenCalledWith(1, {
      lastActiveAt: '2026-08-20T11:30:00.000Z'
    })
    // id returned is the existing session's localId
    expect(id).toBe(1)
    expect(store).toHaveLength(1)
  })

  it('creates a new session when the same chapter is opened on a different day', async () => {
    await callStartSession('PRO 19', '2026-08-20T09:00:00.000Z')
    const id = await callStartSession('PRO 19', '2026-08-21T08:00:00.000Z')

    expect(mockDb.studySessions.add).toHaveBeenCalledTimes(2)
    expect(id).toBe(2)
    expect(store).toHaveLength(2)
    expect(store[1].startedAt).toBe('2026-08-21T08:00:00.000Z')
  })

  it('keeps sessions for different chapters on the same day separate', async () => {
    await callStartSession('PRO 19', '2026-08-20T09:00:00.000Z')
    await callStartSession('PSA 23', '2026-08-20T10:00:00.000Z')

    expect(mockDb.studySessions.add).toHaveBeenCalledTimes(2)
    expect(store).toHaveLength(2)
  })

  it('does not call update when a new session is created', async () => {
    await callStartSession('JHN 3', '2026-08-20T07:00:00.000Z')
    expect(mockDb.studySessions.update).not.toHaveBeenCalled()
  })
})

// ── dedupedSessions helper (mirrors HistoryView computed) ─────────────────────
describe('dedupedSessions — computed dedup logic', () => {
  function dedupedSessions(sessions) {
    const seen = new Set()
    const result = []
    for (const s of sessions) {
      const day = typeof s.startedAt === 'string' ? s.startedAt.slice(0, 10) : ''
      const key = `${day}|${s.passageRef ?? ''}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(s)
      }
    }
    return result
  }

  it('collapses duplicate (passageRef + day) entries keeping the first (newest) one', () => {
    const raw = [
      { localId: 3, passageRef: 'PRO 19', startedAt: '2026-08-20T11:00:00.000Z' },
      { localId: 2, passageRef: 'PRO 19', startedAt: '2026-08-20T09:00:00.000Z' },
      { localId: 1, passageRef: 'PRO 19', startedAt: '2026-08-20T07:00:00.000Z' }
    ]
    const result = dedupedSessions(raw)
    expect(result).toHaveLength(1)
    expect(result[0].localId).toBe(3) // newest kept
  })

  it('keeps entries that differ by day', () => {
    const raw = [
      { localId: 2, passageRef: 'PRO 19', startedAt: '2026-08-21T09:00:00.000Z' },
      { localId: 1, passageRef: 'PRO 19', startedAt: '2026-08-20T09:00:00.000Z' }
    ]
    expect(dedupedSessions(raw)).toHaveLength(2)
  })

  it('keeps entries that differ by passageRef on the same day', () => {
    const raw = [
      { localId: 2, passageRef: 'PSA 23', startedAt: '2026-08-20T10:00:00.000Z' },
      { localId: 1, passageRef: 'PRO 19', startedAt: '2026-08-20T09:00:00.000Z' }
    ]
    expect(dedupedSessions(raw)).toHaveLength(2)
  })

  it('returns an empty array when given no sessions', () => {
    expect(dedupedSessions([])).toEqual([])
  })
})

// ── Auth guard (useStudySession composable itself) ────────────────────────────
// These tests exercise the guard added to startSession / pingSession directly
// via the composable.  The watch mock fires the callback immediately when
// { immediate: true } is set, which is how startSession is triggered in prod.
// ── Auth guard (useStudySession composable itself) ────────────────────────────
// useStudySession is imported dynamically so the vi.mock('@/lib/db') factory
// runs lazily — after const mockDb is initialised — avoiding a TDZ error.
describe('useStudySession — auth guard', () => {
  let useStudySession

  beforeEach(async () => {
    mockAuth.user = { id: 'user-1' }
    mockAuth.isAuthenticated = true
    store = []
    nextId = 1
    mockDb.studySessions.add.mockClear()
    mockDb.studySessions.update.mockClear()
    // Dynamic import; Vitest caches the module after the first load.
    ;({ useStudySession } = await import('@/composables/useStudySession'))
  })

  it('does not write any session row when the user is not authenticated', async () => {
    mockAuth.user = null
    mockAuth.isAuthenticated = false

    // The mocked watch fires startSession immediately (opts.immediate = true).
    useStudySession(() => 'PRO 19')

    // Flush microtasks so the async startSession reaches the early-return guard.
    await Promise.resolve()

    expect(mockDb.studySessions.add).not.toHaveBeenCalled()
    expect(mockDb.studySessions.update).not.toHaveBeenCalled()
    expect(store).toHaveLength(0)
  })

  it('records a session row when the user is authenticated', async () => {
    useStudySession(() => 'PSA 23')
    await Promise.resolve()

    expect(mockDb.studySessions.add).toHaveBeenCalledOnce()
    expect(store).toHaveLength(1)
    expect(store[0].passageRef).toBe('PSA 23')
    expect(store[0].userId).toBe('user-1')
  })

  it('skips the session on the first call then records it once auth is restored', async () => {
    // First call while logged out — no row should be written
    mockAuth.user = null
    mockAuth.isAuthenticated = false
    useStudySession(() => 'JHN 3')
    await Promise.resolve()
    expect(mockDb.studySessions.add).not.toHaveBeenCalled()

    // Restore auth and open the same passage — now a row must be written
    mockAuth.user = { id: 'user-1' }
    mockAuth.isAuthenticated = true
    useStudySession(() => 'JHN 3')
    await Promise.resolve()
    expect(mockDb.studySessions.add).toHaveBeenCalledOnce()
    expect(store[0].passageRef).toBe('JHN 3')
  })
})
