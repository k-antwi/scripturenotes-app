import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNotebooksStore } from '@/stores/notebooks'

// ── Dexie mock ────────────────────────────────────────────────────────────────
const mockNotebooks = []
const mockSyncQueue = []
const mockAnnotationNotebook = []

const makeTable = (store) => ({
  add: vi.fn(async (row) => { store.push({ ...row, localId: store.length + 1 }); return store.length }),
  get: vi.fn(async (id) => store.find((r) => r.localId === id)),
  update: vi.fn(async (id, patch) => { const r = store.find((r) => r.localId === id); if (r) Object.assign(r, patch) }),
  delete: vi.fn(async (id) => { const idx = store.findIndex((r) => r.localId === id); if (idx !== -1) store.splice(idx, 1) }),
  where: vi.fn(() => ({ first: vi.fn(async () => null), delete: vi.fn(async () => {}), modify: vi.fn(async () => {}) })),
  orderBy: vi.fn(() => ({ toArray: vi.fn(async () => store) }))
})

vi.mock('@/lib/db', () => ({
  db: {
    notebooks: makeTable(mockNotebooks),
    syncQueue: makeTable(mockSyncQueue),
    annotationNotebook: makeTable(mockAnnotationNotebook),
    annotations: makeTable([]),
    transaction: vi.fn(async (mode, tables, fn) => fn())
  }
}))

// ── API mock ──────────────────────────────────────────────────────────────────
const mockNotebookApiList = vi.fn()
const mockNotebookApiCreate = vi.fn()
const mockNotebookApiUpdate = vi.fn()
const mockNotebookApiDestroy = vi.fn()
const mockNotebookApiAddAnnotation = vi.fn()
const mockNotebookApiRemoveAnnotation = vi.fn()

vi.mock('@/lib/api', () => ({
  NotebookAPI: {
    list: mockNotebookApiList,
    create: mockNotebookApiCreate,
    update: mockNotebookApiUpdate,
    destroy: mockNotebookApiDestroy,
    addAnnotation: mockNotebookApiAddAnnotation,
    removeAnnotation: mockNotebookApiRemoveAnnotation
  }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 1 } })
}))

// ─────────────────────────────────────────────────────────────────────────────

describe('useNotebooksStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockNotebooks.length = 0
    mockSyncQueue.length = 0
    mockAnnotationNotebook.length = 0
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('writes to Dexie with dirty flag and pushes to API when online', async () => {
      mockNotebookApiCreate.mockResolvedValue({ data: { id: 42 } })

      const store = useNotebooksStore()
      const localId = await store.create({ title: 'Sermon Notes' })

      expect(localId).toBe(1)
      const added = mockNotebooks[0]
      expect(added.title).toBe('Sermon Notes')
      expect(added.dirty).toBe(true)

      // API push should mark dirty false
      expect(mockNotebookApiCreate).toHaveBeenCalledWith({ title: 'Sermon Notes', description: null })
      expect(mockNotebooks[0].remoteId).toBe(42)
      expect(mockNotebooks[0].dirty).toBe(false)
    })

    it('leaves dirty:true and enqueues sync when API call fails', async () => {
      mockNotebookApiCreate.mockRejectedValue(new Error('offline'))

      const store = useNotebooksStore()
      await store.create({ title: 'Offline Notebook' })

      expect(mockNotebooks[0].dirty).toBe(true)
      expect(mockSyncQueue.length).toBe(1)
      expect(mockSyncQueue[0].entityType).toBe('notebook')
      expect(mockSyncQueue[0].action).toBe('create')
    })

    it('trims whitespace from title', async () => {
      mockNotebookApiCreate.mockResolvedValue({ data: { id: 1 } })

      const store = useNotebooksStore()
      await store.create({ title: '  Whitespace  ' })

      expect(mockNotebooks[0].title).toBe('Whitespace')
    })
  })

  describe('remove', () => {
    it('deletes from Dexie and calls API when remoteId exists', async () => {
      mockNotebooks.push({ localId: 1, remoteId: 99, title: 'Old', dirty: false })
      const notebooksTable = (await import('@/lib/db')).db.notebooks
      notebooksTable.get.mockResolvedValue(mockNotebooks[0])

      mockNotebookApiDestroy.mockResolvedValue({})

      const store = useNotebooksStore()
      await store.remove(1)

      expect(mockNotebookApiDestroy).toHaveBeenCalledWith(99)
    })

    it('enqueues delete to syncQueue when API call fails', async () => {
      mockNotebooks.push({ localId: 1, remoteId: 99, title: 'Old', dirty: false })
      const notebooksTable = (await import('@/lib/db')).db.notebooks
      notebooksTable.get.mockResolvedValue(mockNotebooks[0])

      mockNotebookApiDestroy.mockRejectedValue(new Error('offline'))

      const store = useNotebooksStore()
      await store.remove(1)

      expect(mockSyncQueue.length).toBe(1)
      expect(mockSyncQueue[0].action).toBe('delete')
    })
  })

  describe('fetchFromApi', () => {
    it('upserts remote notebooks into Dexie', async () => {
      mockNotebookApiList.mockResolvedValue({
        data: [{ id: 10, user_id: 1, title: 'Remote NB', description: null, updated_at: '2026-08-01T00:00:00Z' }]
      })

      const notebooksTable = (await import('@/lib/db')).db.notebooks
      notebooksTable.where.mockReturnValue({ first: vi.fn(async () => null) })

      const store = useNotebooksStore()
      await store.fetchFromApi()

      expect(store.error).toBeNull()
      expect(store.syncing).toBe(false)
    })

    it('sets error state when API fails', async () => {
      mockNotebookApiList.mockRejectedValue({ message: 'Network Error' })

      const store = useNotebooksStore()
      await store.fetchFromApi()

      expect(store.error).toBe('Network Error')
    })
  })
})
