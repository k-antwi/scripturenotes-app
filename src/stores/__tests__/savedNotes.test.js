import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSavedNotesStore } from '@/stores/savedNotes'

// ── Dexie mock ────────────────────────────────────────────────────────────────
const mockSavedNotes = []
const mockSavedNotePassages = []

const makeSavedNotesTable = () => ({
  add: vi.fn(async (row) => {
    const localId = mockSavedNotes.length + 1
    mockSavedNotes.push({ ...row, localId })
    return localId
  }),
  get: vi.fn(async (id) => mockSavedNotes.find((r) => r.localId === id)),
  update: vi.fn(async (id, patch) => {
    const row = mockSavedNotes.find((r) => r.localId === id)
    if (row) Object.assign(row, patch)
  }),
  delete: vi.fn(async (id) => {
    const idx = mockSavedNotes.findIndex((r) => r.localId === id)
    if (idx !== -1) mockSavedNotes.splice(idx, 1)
  }),
  orderBy: vi.fn(() => ({
    reverse: vi.fn(() => ({ toArray: vi.fn(async () => [...mockSavedNotes].reverse()) }))
  }))
})

const makeSavedNotePassagesTable = () => ({
  add: vi.fn(async (row) => {
    const localId = mockSavedNotePassages.length + 1
    mockSavedNotePassages.push({ ...row, localId })
    return localId
  }),
  update: vi.fn(async (id, patch) => {
    const row = mockSavedNotePassages.find((r) => r.localId === id)
    if (row) Object.assign(row, patch)
  }),
  where: vi.fn((compound) => {
    // Support both string key for delete and compound index for equals
    return {
      equals: vi.fn((val) => ({
        first: vi.fn(async () => {
          if (!Array.isArray(val)) return null
          const [noteId, book, chapter] = val
          return mockSavedNotePassages.find(
            (p) =>
              p.savedNoteLocalId === noteId &&
              p.book === book &&
              p.chapter === chapter
          ) ?? null
        })
      })),
      delete: vi.fn(async () => {
        // used as where({ savedNoteLocalId: localId }).delete()
        // The argument to where is the object; we capture it via closure below
      })
    }
  }),
  toArray: vi.fn(async () => [...mockSavedNotePassages])
})

// We need `where({ savedNoteLocalId })` to delete rows — patch the mock below
const savedNotePassagesTable = makeSavedNotePassagesTable()
// Override `where` to handle object form used in remove()
savedNotePassagesTable.where = vi.fn((query) => {
  if (typeof query === 'string') {
    // Compound index: '[savedNoteLocalId+book+chapter]'
    return {
      equals: vi.fn((val) => ({
        first: vi.fn(async () => {
          const [noteId, book, chapter] = val
          return (
            mockSavedNotePassages.find(
              (p) =>
                p.savedNoteLocalId === noteId &&
                p.book === book &&
                p.chapter === chapter
            ) ?? null
          )
        })
      }))
    }
  }
  // Object form: { savedNoteLocalId: id }
  const { savedNoteLocalId } = query
  return {
    delete: vi.fn(async () => {
      let i = mockSavedNotePassages.length
      while (i--) {
        if (mockSavedNotePassages[i].savedNoteLocalId === savedNoteLocalId) {
          mockSavedNotePassages.splice(i, 1)
        }
      }
    })
  }
})

vi.mock('@/lib/db', () => ({
  db: {
    savedNotes: makeSavedNotesTable(),
    savedNotePassages: savedNotePassagesTable
  }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'user-1' } })
}))

// ─────────────────────────────────────────────────────────────────────────────

describe('useSavedNotesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSavedNotes.length = 0
    mockSavedNotePassages.length = 0
    vi.clearAllMocks()
  })

  // ── save ───────────────────────────────────────────────────────────────────
  describe('save', () => {
    it('creates a savedNote header and the first passage row', async () => {
      const store = useSavedNotesStore()
      const localId = await store.save({
        name: 'Sunday Sermon Prep',
        book: 'PRO',
        chapter: 19,
        passageRef: 'Proverbs 19',
        annotationCount: 3
      })

      expect(localId).toBe(1)
      expect(mockSavedNotes).toHaveLength(1)
      expect(mockSavedNotes[0].name).toBe('Sunday Sermon Prep')
      expect(mockSavedNotes[0].dirty).toBe(true)
      expect(mockSavedNotes[0].userId).toBe('user-1')

      expect(mockSavedNotePassages).toHaveLength(1)
      expect(mockSavedNotePassages[0].savedNoteLocalId).toBe(localId)
      expect(mockSavedNotePassages[0].book).toBe('PRO')
      expect(mockSavedNotePassages[0].chapter).toBe(19)
      expect(mockSavedNotePassages[0].annotationCount).toBe(3)
    })

    it('trims whitespace from the note name', async () => {
      const store = useSavedNotesStore()
      await store.save({ name: '  Week 3 Study  ', book: 'JHN', chapter: 3, passageRef: 'John 3' })
      expect(mockSavedNotes[0].name).toBe('Week 3 Study')
    })

    it('defaults annotationCount to 0', async () => {
      const store = useSavedNotesStore()
      await store.save({ name: 'Quick read', book: 'PSA', chapter: 23, passageRef: 'Psalm 23' })
      expect(mockSavedNotePassages[0].annotationCount).toBe(0)
    })

    it('rejects when name is empty or whitespace-only', async () => {
      const store = useSavedNotesStore()
      await expect(
        store.save({ name: '  ', book: 'PRO', chapter: 1, passageRef: 'Proverbs 1' })
      ).rejects.toThrow('Note name cannot be empty.')
    })

    it('resets saving flag after a successful save', async () => {
      const store = useSavedNotesStore()
      await store.save({ name: 'Test', book: 'ROM', chapter: 8, passageRef: 'Romans 8' })
      expect(store.saving).toBe(false)
    })
  })

  // ── addPassage ─────────────────────────────────────────────────────────────
  describe('addPassage', () => {
    it('adds a new passage row to an existing note', async () => {
      // Pre-seed a note
      mockSavedNotes.push({ localId: 1, name: 'Study Note', updatedAt: '2026-01-01T00:00:00Z', dirty: false })

      // Simulate where().equals().first() returning null (no existing passage)
      savedNotePassagesTable.where.mockReturnValueOnce({
        equals: vi.fn(() => ({ first: vi.fn(async () => null) }))
      })

      const store = useSavedNotesStore()
      await store.addPassage(1, {
        book: 'JHN',
        chapter: 3,
        passageRef: 'John 3',
        annotationCount: 2
      })

      expect(savedNotePassagesTable.add).toHaveBeenCalledWith(
        expect.objectContaining({ savedNoteLocalId: 1, book: 'JHN', chapter: 3 })
      )
    })

    it('updates annotation count when the same passage is added again', async () => {
      mockSavedNotes.push({ localId: 1, name: 'Study Note', updatedAt: '2026-01-01T00:00:00Z', dirty: false })

      const existingPassage = { localId: 5, savedNoteLocalId: 1, book: 'JHN', chapter: 3, annotationCount: 1 }

      // Simulate where().equals().first() returning the existing row
      savedNotePassagesTable.where.mockReturnValueOnce({
        equals: vi.fn(() => ({ first: vi.fn(async () => existingPassage) }))
      })

      const store = useSavedNotesStore()
      await store.addPassage(1, { book: 'JHN', chapter: 3, passageRef: 'John 3', annotationCount: 5 })

      // Should update, not add a new row
      expect(savedNotePassagesTable.add).not.toHaveBeenCalled()
      expect(savedNotePassagesTable.update).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ annotationCount: 5 })
      )
    })

    it('bumps updatedAt on the parent note', async () => {
      const note = { localId: 1, name: 'Study Note', updatedAt: '2026-01-01T00:00:00Z', dirty: false }
      mockSavedNotes.push(note)

      savedNotePassagesTable.where.mockReturnValueOnce({
        equals: vi.fn(() => ({ first: vi.fn(async () => null) }))
      })

      const { db: dbMock } = await import('@/lib/db')

      const store = useSavedNotesStore()
      await store.addPassage(1, { book: 'PSA', chapter: 23, passageRef: 'Psalm 23' })

      expect(dbMock.savedNotes.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ dirty: true })
      )
    })
  })

  // ── rename ─────────────────────────────────────────────────────────────────
  describe('rename', () => {
    it('updates the name and marks dirty', async () => {
      const note = { localId: 1, name: 'Old Name', dirty: false }
      mockSavedNotes.push(note)
      const { db: dbMock } = await import('@/lib/db')
      dbMock.savedNotes.update.mockImplementation(async (id, patch) => {
        const row = mockSavedNotes.find((r) => r.localId === id)
        if (row) Object.assign(row, patch)
      })

      const store = useSavedNotesStore()
      await store.rename(1, 'New Name')

      expect(mockSavedNotes[0].name).toBe('New Name')
      expect(mockSavedNotes[0].dirty).toBe(true)
    })

    it('trims whitespace on rename', async () => {
      mockSavedNotes.push({ localId: 1, name: 'Old', dirty: false })
      const { db: dbMock } = await import('@/lib/db')
      dbMock.savedNotes.update.mockImplementation(async (id, patch) => {
        const row = mockSavedNotes.find((r) => r.localId === id)
        if (row) Object.assign(row, patch)
      })

      const store = useSavedNotesStore()
      await store.rename(1, '  Trimmed  ')
      expect(mockSavedNotes[0].name).toBe('Trimmed')
    })

    it('rejects when new name is blank', async () => {
      const store = useSavedNotesStore()
      await expect(store.rename(1, '')).rejects.toThrow('Note name cannot be empty.')
    })
  })

  // ── remove ─────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes all passage rows then the note itself', async () => {
      mockSavedNotes.push({ localId: 1, name: 'To delete' })
      mockSavedNotePassages.push(
        { localId: 1, savedNoteLocalId: 1, book: 'PRO', chapter: 19 },
        { localId: 2, savedNoteLocalId: 1, book: 'JHN', chapter: 3 }
      )

      const store = useSavedNotesStore()
      await store.remove(1)

      // Passages for note 1 should be gone
      expect(mockSavedNotePassages.filter((p) => p.savedNoteLocalId === 1)).toHaveLength(0)
      // Note itself should be gone
      expect(mockSavedNotes.find((n) => n.localId === 1)).toBeUndefined()
    })

    it('calls db.savedNotes.delete with the correct localId', async () => {
      const { db: dbMock } = await import('@/lib/db')
      const store = useSavedNotesStore()
      await store.remove(7)
      expect(dbMock.savedNotes.delete).toHaveBeenCalledWith(7)
    })
  })
})
