import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBookmarksStore } from '@/stores/bookmarks'

// ── Dexie mock ────────────────────────────────────────────────────────────────
const mockBookmarks = []
const mockSyncQueue = []

const makeTable = (store) => ({
  add: vi.fn(async (row) => { store.push({ ...row, localId: store.length + 1 }); return store.length }),
  get: vi.fn(async (id) => store.find((r) => r.localId === id)),
  update: vi.fn(async (id, patch) => { const r = store.find((r) => r.localId === id); if (r) Object.assign(r, patch) }),
  delete: vi.fn(async (id) => { const idx = store.findIndex((r) => r.localId === id); if (idx !== -1) store.splice(idx, 1) }),
  where: vi.fn(() => ({
    first: vi.fn(async () => null),
    delete: vi.fn(async () => {})
  })),
  orderBy: vi.fn(() => ({ reverse: () => ({ toArray: vi.fn(async () => store) }) }))
})

vi.mock('@/lib/db', () => ({
  db: {
    bookmarks: makeTable(mockBookmarks),
    syncQueue: makeTable(mockSyncQueue),
    transaction: vi.fn(async (mode, tables, fn) => fn())
  }
}))

// ── API mock ──────────────────────────────────────────────────────────────────
const mockBookmarkApiList = vi.fn()
const mockBookmarkApiCreate = vi.fn()
const mockBookmarkApiDestroy = vi.fn()

vi.mock('@/lib/api', () => ({
  BookmarkAPI: {
    list: mockBookmarkApiList,
    create: mockBookmarkApiCreate,
    destroy: mockBookmarkApiDestroy
  }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 1 } })
}))

// ─────────────────────────────────────────────────────────────────────────────

describe('useBookmarksStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockBookmarks.length = 0
    mockSyncQueue.length = 0
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('writes bookmark to Dexie with dirty flag and syncs to API when online', async () => {
      mockBookmarkApiCreate.mockResolvedValue({ data: { id: 7 } })

      const store = useBookmarksStore()
      const localId = await store.create({ book: 'GEN', chapter: 1, verse: 1, label: 'Creation' })

      expect(localId).toBe(1)
      expect(mockBookmarks[0].book).toBe('GEN')
      expect(mockBookmarks[0].dirty).toBe(true)

      // After successful API push dirty should clear
      expect(mockBookmarks[0].remoteId).toBe(7)
      expect(mockBookmarks[0].dirty).toBe(false)
    })

    it('is idempotent — returns existing localId when duplicate exists locally', async () => {
      mockBookmarks.push({ localId: 1, book: 'GEN', chapter: 1, verse: 1, dirty: false })
      const bookmarksTable = (await import('@/lib/db')).db.bookmarks
      bookmarksTable.where.mockReturnValue({
        first: vi.fn(async () => mockBookmarks[0])
      })

      const store = useBookmarksStore()
      const localId = await store.create({ book: 'GEN', chapter: 1, verse: 1 })

      expect(localId).toBe(1)
      expect(mockBookmarkApiCreate).not.toHaveBeenCalled()
    })

    it('leaves dirty:true and enqueues sync when API call fails (offline)', async () => {
      mockBookmarkApiCreate.mockRejectedValue(new Error('offline'))

      const store = useBookmarksStore()
      await store.create({ book: 'PSA', chapter: 23, verse: 1 })

      expect(mockBookmarks[0].dirty).toBe(true)
      expect(mockSyncQueue.length).toBe(1)
      expect(mockSyncQueue[0].entityType).toBe('bookmark')
      expect(mockSyncQueue[0].action).toBe('create')
    })
  })

  describe('remove', () => {
    it('deletes from Dexie and calls API when remoteId exists', async () => {
      mockBookmarks.push({ localId: 1, remoteId: 55, book: 'JHN', chapter: 3, verse: 16, dirty: false })
      const bookmarksTable = (await import('@/lib/db')).db.bookmarks
      bookmarksTable.get.mockResolvedValue(mockBookmarks[0])
      mockBookmarkApiDestroy.mockResolvedValue({})

      const store = useBookmarksStore()
      await store.remove(1)

      expect(mockBookmarkApiDestroy).toHaveBeenCalledWith(55)
    })

    it('enqueues delete when API fails (offline)', async () => {
      mockBookmarks.push({ localId: 1, remoteId: 55, book: 'JHN', chapter: 3, verse: 16, dirty: false })
      const bookmarksTable = (await import('@/lib/db')).db.bookmarks
      bookmarksTable.get.mockResolvedValue(mockBookmarks[0])
      mockBookmarkApiDestroy.mockRejectedValue(new Error('offline'))

      const store = useBookmarksStore()
      await store.remove(1)

      expect(mockSyncQueue.length).toBe(1)
      expect(mockSyncQueue[0].action).toBe('delete')
    })

    it('skips API call when bookmark has no remoteId (never synced)', async () => {
      mockBookmarks.push({ localId: 1, remoteId: null, book: 'ROM', chapter: 8, verse: 28, dirty: true })
      const bookmarksTable = (await import('@/lib/db')).db.bookmarks
      bookmarksTable.get.mockResolvedValue(mockBookmarks[0])

      const store = useBookmarksStore()
      await store.remove(1)

      expect(mockBookmarkApiDestroy).not.toHaveBeenCalled()
    })
  })

  describe('fetchFromApi', () => {
    it('upserts remote bookmarks into Dexie without touching dirty local rows', async () => {
      mockBookmarkApiList.mockResolvedValue({
        data: [{ id: 1, user_id: 1, book: 'PSA', chapter: 23, verse: 1, label: null, updated_at: '2026-01-01T00:00:00Z' }]
      })

      const bookmarksTable = (await import('@/lib/db')).db.bookmarks
      bookmarksTable.where.mockReturnValue({ first: vi.fn(async () => null) })

      const store = useBookmarksStore()
      await store.fetchFromApi()

      expect(store.error).toBeNull()
      expect(store.syncing).toBe(false)
    })

    it('sets error state on API failure', async () => {
      mockBookmarkApiList.mockRejectedValue({ message: 'Unauthorized' })

      const store = useBookmarksStore()
      await store.fetchFromApi()

      expect(store.error).toBe('Unauthorized')
    })
  })
})
