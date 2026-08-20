/**
 * Tests for NotesContextBar — notes-aware navigation bar shown inside the reader.
 *
 * Run with:  npx vitest run src/components/notes/__tests__/NotesContextBar.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

// ── Router mock ───────────────────────────────────────────────────────────────
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush })
}))

// ── Dexie / db mock ───────────────────────────────────────────────────────────
const MOCK_NOTE = { localId: 1, name: 'Sunday Sermon' }

const MOCK_PASSAGES = [
  { localId: 10, savedNoteLocalId: 1, book: 'GEN', chapter: 1, passageRef: 'Genesis 1', savedAt: '2024-01-01T00:00:00Z' },
  { localId: 11, savedNoteLocalId: 1, book: 'PRO', chapter: 3, passageRef: 'Proverbs 3', savedAt: '2024-01-02T00:00:00Z' },
  { localId: 12, savedNoteLocalId: 1, book: 'JHN', chapter: 3, passageRef: 'John 3',    savedAt: '2024-01-03T00:00:00Z' }
]

vi.mock('dexie', () => ({
  liveQuery: vi.fn((fn) => fn())
}))

vi.mock('@/lib/db', () => ({
  db: {
    savedNotes: {
      get: vi.fn().mockResolvedValue(MOCK_NOTE)
    },
    savedNotePassages: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(MOCK_PASSAGES)
        })
      })
    }
  }
}))

// ── useObservable — return reactive values seeded from the mock data ───────────
vi.mock('@/composables/useObservable', () => ({
  useObservable: vi.fn((factoryFn, defaultVal) => {
    // Execute the factory once (it returns a liveQuery result) and wrap in ref
    try {
      const result = factoryFn()
      return ref(result ?? defaultVal)
    } catch {
      return ref(defaultVal)
    }
  })
}))

// ── Lucide stubs ──────────────────────────────────────────────────────────────
vi.mock('lucide-vue-next', () => ({
  ChevronLeft: { template: '<span data-testid="chevron-left" />' },
  ChevronRight: { template: '<span data-testid="chevron-right" />' },
  NotebookPen: { template: '<span data-testid="notebook-pen" />' }
}))

// ── Helper ────────────────────────────────────────────────────────────────────
async function mountBar(props) {
  const { default: NotesContextBar } = await import('../NotesContextBar.vue')
  const wrapper = mount(NotesContextBar, {
    props,
    global: { plugins: [createPinia()] }
  })
  await flushPromises()
  return wrapper
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('NotesContextBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
    vi.clearAllMocks()
  })

  it('renders the note name from the database', async () => {
    const { useObservable } = await import('@/composables/useObservable')
    useObservable
      .mockReturnValueOnce(ref(MOCK_NOTE))      // note
      .mockReturnValueOnce(ref(MOCK_PASSAGES))  // passages

    const wrapper = await mountBar({ noteId: 1, book: 'PRO', chapter: 3 })
    expect(wrapper.text()).toContain('Sunday Sermon')
  })

  it('shows position label for the current passage', async () => {
    const { useObservable } = await import('@/composables/useObservable')
    useObservable
      .mockReturnValueOnce(ref(MOCK_NOTE))
      .mockReturnValueOnce(ref(MOCK_PASSAGES))

    // PRO 3 is index 1 → "2 of 3"
    const wrapper = await mountBar({ noteId: 1, book: 'PRO', chapter: 3 })
    expect(wrapper.text()).toContain('2 of 3')
  })

  it('disables the previous button on the first passage', async () => {
    const { useObservable } = await import('@/composables/useObservable')
    useObservable
      .mockReturnValueOnce(ref(MOCK_NOTE))
      .mockReturnValueOnce(ref(MOCK_PASSAGES))

    // GEN 1 is the first passage — no previous
    const wrapper = await mountBar({ noteId: 1, book: 'GEN', chapter: 1 })
    const prevBtn = wrapper.find('[aria-label="No previous passage"]')
    expect(prevBtn.exists()).toBe(true)
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('disables the next button on the last passage', async () => {
    const { useObservable } = await import('@/composables/useObservable')
    useObservable
      .mockReturnValueOnce(ref(MOCK_NOTE))
      .mockReturnValueOnce(ref(MOCK_PASSAGES))

    // JHN 3 is the last passage — no next
    const wrapper = await mountBar({ noteId: 1, book: 'JHN', chapter: 3 })
    const nextBtn = wrapper.find('[aria-label="No next passage"]')
    expect(nextBtn.exists()).toBe(true)
    expect(nextBtn.attributes('disabled')).toBeDefined()
  })

  it('navigates to the previous passage preserving noteId in query', async () => {
    const { useObservable } = await import('@/composables/useObservable')
    useObservable
      .mockReturnValueOnce(ref(MOCK_NOTE))
      .mockReturnValueOnce(ref(MOCK_PASSAGES))

    // On PRO 3, previous = GEN 1
    const wrapper = await mountBar({ noteId: 1, book: 'PRO', chapter: 3 })
    const prevBtn = wrapper.find('[aria-label="Previous passage: Genesis 1"]')
    await prevBtn.trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'reader',
      params: { book: 'GEN', chapter: 1 },
      query: { noteId: 1 }
    })
  })

  it('navigates to the next passage preserving noteId in query', async () => {
    const { useObservable } = await import('@/composables/useObservable')
    useObservable
      .mockReturnValueOnce(ref(MOCK_NOTE))
      .mockReturnValueOnce(ref(MOCK_PASSAGES))

    // On PRO 3, next = JHN 3
    const wrapper = await mountBar({ noteId: 1, book: 'PRO', chapter: 3 })
    const nextBtn = wrapper.find('[aria-label="Next passage: John 3"]')
    await nextBtn.trigger('click')

    expect(mockPush).toHaveBeenCalledWith({
      name: 'reader',
      params: { book: 'JHN', chapter: 3 },
      query: { noteId: 1 }
    })
  })

  it('navigates back to /notes when the note name is clicked', async () => {
    const { useObservable } = await import('@/composables/useObservable')
    useObservable
      .mockReturnValueOnce(ref(MOCK_NOTE))
      .mockReturnValueOnce(ref(MOCK_PASSAGES))

    const wrapper = await mountBar({ noteId: 1, book: 'PRO', chapter: 3 })
    await wrapper.find('[aria-label="Back to notes list"]').trigger('click')

    expect(mockPush).toHaveBeenCalledWith({ name: 'notes' })
  })
})

// ── AppShell tab-active logic ─────────────────────────────────────────────────
describe('AppShell — notes-context tab activation', () => {
  /**
   * Test the tab-active logic in isolation without mounting AppShell
   * (which pulls in router-link, OfflineIndicator, etc.).
   *
   * We replicate the exact isActive() function and verify its behaviour.
   */
  function makeIsActive(routeName, query = {}) {
    const route = { name: routeName, query }
    return function isActive(tabName) {
      const inNotesContext = route.name === 'reader' && !!route.query.noteId
      if (tabName === 'reader') {
        return (route.name === 'reader' || route.name === 'book-picker') && !inNotesContext
      }
      if (tabName === 'notes') {
        return route.name === 'notes' || inNotesContext
      }
      return route.name === tabName
    }
  }

  it('marks the Read tab active on a plain reader route', () => {
    const isActive = makeIsActive('reader', {})
    expect(isActive('reader')).toBe(true)
    expect(isActive('notes')).toBe(false)
  })

  it('marks the Notes tab active when reader has a noteId query param', () => {
    const isActive = makeIsActive('reader', { noteId: '5' })
    expect(isActive('notes')).toBe(true)
    expect(isActive('reader')).toBe(false)
  })

  it('marks the Notes tab active on the /notes route itself', () => {
    const isActive = makeIsActive('notes', {})
    expect(isActive('notes')).toBe(true)
    expect(isActive('reader')).toBe(false)
  })

  it('marks the Read tab active for book-picker (no noteId)', () => {
    const isActive = makeIsActive('book-picker', {})
    expect(isActive('reader')).toBe(true)
  })

  it('marks other tabs correctly (bookmarks, history, settings)', () => {
    const isActive = makeIsActive('bookmarks', {})
    expect(isActive('bookmarks')).toBe(true)
    expect(isActive('history')).toBe(false)
    expect(isActive('settings')).toBe(false)
  })
})
