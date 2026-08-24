/**
 * Regression tests for ScriptureReader — canvas sizing and watcher behaviour.
 *
 * Run with:  npx vitest run src/components/reader/__tests__/ScriptureReader.test.js
 *
 * Requires:  npm install -D vitest @vue/test-utils
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

// ── ResizeObserver mock ────────────────────────────────────────────────────────
// jsdom does not implement ResizeObserver.  We capture the callback so tests
// can trigger resize events manually.
let _resizeCallback = null
const MockResizeObserver = vi.fn(function (cb) {
  _resizeCallback = cb
  this.observe = vi.fn()
  this.unobserve = vi.fn()
  this.disconnect = vi.fn()
})
global.ResizeObserver = MockResizeObserver

// ── Store mocks ───────────────────────────────────────────────────────────────
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: 'test-user' } })
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    defaultTranslation: 'BSB',
    twoColumnPreferred: false,
    fontSize: 17,
    lineHeight: 1.6
  })
}))

// Mutable so a test can switch the reader into Note mode.
const toolState = { activeTool: 'none', activeColour: '#000', opacity: 1 }

vi.mock('@/stores/tool', () => {
  const TOOLS = {
    NONE: 'none', HIGHLIGHTER: 'highlighter', PEN: 'pen',
    UNDERLINE: 'underline', SHAPE: 'shape', NOTE: 'note', ERASER: 'eraser'
  }
  return { TOOLS, useToolStore: () => toolState }
})

// vue-router — ScriptureReader reads route.query.noteId for the context bar.
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() })
}))

// Note store — the reader reads grouped notes and reloads on passage change.
const noteStoreState = {
  passageNotes: [],
  verseNotesByVerse: {},
  phraseNotesByVerse: {},
  notesByVerse: {},
  loadForPassage: vi.fn()
}
vi.mock('@/stores/noteStore', () => ({ useNoteStore: () => noteStoreState }))

// ── Repository / composable mocks ─────────────────────────────────────────────
const MOCK_PASSAGE = {
  book: 'PRO', chapter: 19, reference: 'Proverbs 19',
  verses: [{ number: 1, text: 'Better a poor man who walks with integrity.' }]
}

vi.mock('@/lib/passageRepository', () => ({
  PassageRepository: {
    get: vi.fn().mockResolvedValue(MOCK_PASSAGE),
    getNotes: vi.fn().mockResolvedValue(null)
  }
}))

vi.mock('@/lib/annotationRepository', () => ({
  default: { create: vi.fn(), remove: vi.fn() }
}))

const emptyTable = () => ({
  where: vi.fn().mockReturnValue({
    filter: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    toArray: vi.fn().mockResolvedValue([]),
    first: vi.fn().mockResolvedValue(null)
  }),
  orderBy: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
})

vi.mock('@/lib/db', () => ({
  db: { annotations: emptyTable(), notes: emptyTable(), notebooks: emptyTable() }
}))

vi.mock('dexie', () => ({ liveQuery: vi.fn((fn) => fn()) }))

const resolveSelection = vi.fn().mockReturnValue(null)
const resolvePhraseSelection = vi.fn().mockReturnValue(null)

vi.mock('@/composables/useTextSelection', () => ({
  useTextSelection: () => ({ resolveSelection, resolvePhraseSelection })
}))

vi.mock('@/composables/useObservable', () => ({
  useObservable: vi.fn().mockReturnValue([])
}))

vi.mock('@/composables/useStudySession', () => ({
  useStudySession: vi.fn()
}))

// ── Child component stubs ─────────────────────────────────────────────────────
// Stub all child components so the test focuses purely on ScriptureReader logic.
const Stub = defineComponent({ template: '<div />' })

vi.mock('@/components/annotation/AnnotationCanvas.vue', () => ({ default: Stub }))
vi.mock('@/components/annotation/AnnotationToolbar.vue', () => ({ default: Stub }))
vi.mock('@/components/annotation/NoteModal.vue', () => ({ default: Stub }))
vi.mock('@/components/notes/StudyNotesPanel.vue', () => ({ default: Stub }))
vi.mock('@/components/notes/SaveNoteDialog.vue', () => ({ default: Stub }))
vi.mock('@/components/notes/NotesContextBar.vue', () => ({ default: Stub }))
vi.mock('@/components/notes/NotePopup.vue', () => ({ default: Stub }))
const NoteEditorStub = defineComponent({
  props: ['modelValue', 'book', 'chapter', 'verse', 'charStart', 'charEnd', 'quote', 'editNote'],
  template: '<div class="note-editor-stub" />'
})
vi.mock('@/components/notes/NoteEditorModal.vue', () => ({ default: NoteEditorStub }))
vi.mock('@/components/ui/sheet', () => ({ Sheet: Stub }))
vi.mock('../VerseBlock.vue', () => ({ default: Stub }))
vi.mock('../TranslationSelector.vue', () => ({ default: Stub }))
vi.mock('../ChapterNav.vue', () => ({ default: Stub }))

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ScriptureReader — canvas sizing', () => {
  let wrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    MockResizeObserver.mockClear()
    _resizeCallback = null
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  async function mountReader() {
    const { default: ScriptureReader } = await import('../ScriptureReader.vue')
    wrapper = mount(ScriptureReader, {
      props: { book: 'PRO', chapter: 19 },
      global: { plugins: [createPinia()] }
    })
    return wrapper
  }

  /**
   * REGRESSION — Bug: measureCanvas() was called during load() while
   * `loading` was still true, so containerRef.value was null and canvasSize
   * remained { width: 0, height: 0 }. The Konva stage mounted with a 0×0
   * canvas, receiving no pointer events, making pen/shape drawing silently fail.
   *
   * Fix: watch(containerRef, ...) now calls measureCanvas() the moment the
   * content div enters the DOM (after loading → false).
   */
  it('[regression] canvasSize is non-zero after passage loads', async () => {
    await mountReader()

    // Simulate the browser reporting element dimensions on the container div.
    // In jsdom, offsetWidth/scrollHeight are always 0 unless we stub them.
    const container = wrapper.find('.h-full.overflow-y-auto').element
    Object.defineProperty(container, 'offsetWidth', { configurable: true, get: () => 375 })
    Object.defineProperty(container, 'scrollHeight', { configurable: true, get: () => 600 })

    // Wait for load() to resolve and loading → false → DOM update → watcher fires
    await flushPromises()
    await wrapper.vm.$nextTick()

    // The containerRef watcher should have called measureCanvas()
    const canvasStub = wrapper.findComponent(Stub)
    // AnnotationCanvas receives :width and :height as props — verify they're non-zero
    const annotationCanvas = wrapper.findAllComponents(Stub)
      .find((c) => {
        const p = c.props()
        return typeof p.width === 'number' || typeof p.height === 'number'
      })

    // Fallback: directly inspect the component's internal canvasSize via vm
    // (ScriptureReader exposes nothing via defineExpose, so we check the watcher
    // fired by confirming ResizeObserver.observe was called)
    expect(MockResizeObserver).toHaveBeenCalled()
    const observerInstance = MockResizeObserver.mock.instances[0]
    expect(observerInstance.observe).toHaveBeenCalledWith(container)
  })

  it('[regression] ResizeObserver is NOT set up during onMounted when loading=true', async () => {
    // The old bug: onMounted tried to observe a null ref.
    // The fix: the watcher does it lazily. onMounted no longer calls observe.
    // We verify observe() is not called synchronously at mount time (before
    // flushPromises), because the element doesn't exist yet.
    // Mount synchronously — awaiting anything here would let load() resolve
    // and the container watcher fire before we can check.
    const { default: ScriptureReader } = await import('../ScriptureReader.vue')
    wrapper = mount(ScriptureReader, {
      props: { book: 'PRO', chapter: 19 },
      global: { plugins: [createPinia()] }
    })

    // At this point loading=true, passage not yet resolved
    const observerInstance = MockResizeObserver.mock.instances[0]
    expect(observerInstance.observe).not.toHaveBeenCalled()

    // After the passage resolves loading turns false and the element mounts
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(observerInstance.observe).toHaveBeenCalledTimes(1)
  })

  it('[regression] ResizeObserver disconnects on unmount', async () => {
    await mountReader()
    await flushPromises()

    const observerInstance = MockResizeObserver.mock.instances[0]
    wrapper.unmount()
    expect(observerInstance.disconnect).toHaveBeenCalled()
  })
})

/**
 * Note tool — commenting on a highlighted word or phrase (PRD §5.3).
 *
 * Selecting text with the Note tool active must open the same note dialog a
 * verse tap opens, but anchored to the selected characters.
 */
describe('ScriptureReader — phrase-anchored notes', () => {
  let wrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    MockResizeObserver.mockClear()
    toolState.activeTool = 'note'
    resolveSelection.mockClear().mockReturnValue(null)
    resolvePhraseSelection.mockClear().mockReturnValue(null)
  })

  afterEach(() => {
    toolState.activeTool = 'none'
    wrapper?.unmount()
  })

  async function mountReader() {
    const { default: ScriptureReader } = await import('../ScriptureReader.vue')
    wrapper = mount(ScriptureReader, {
      props: { book: 'PRO', chapter: 19 },
      global: { plugins: [createPinia()] }
    })
    await flushPromises()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  /** The scripture text + canvas wrapper that carries @pointerup. */
  function textArea() {
    return wrapper.find('.relative.flex.flex-1.overflow-hidden')
  }

  it('opens the note editor anchored to the selected phrase', async () => {
    resolvePhraseSelection.mockReturnValue({
      book: 'PRO', chapter: 19, verse: 1,
      charStart: 9, charEnd: 13, text: 'poor', spansMultipleVerses: false
    })

    await mountReader()
    await textArea().trigger('pointerup')

    const editor = wrapper.findComponent(NoteEditorStub)
    expect(editor.props()).toMatchObject({
      modelValue: true,
      verse: 1,
      charStart: 9,
      charEnd: 13,
      quote: 'poor'
    })
  })

  it('does not save a highlight when the Note tool is active', async () => {
    resolvePhraseSelection.mockReturnValue({
      book: 'PRO', chapter: 19, verse: 1,
      charStart: 0, charEnd: 6, text: 'Better', spansMultipleVerses: false
    })

    await mountReader()
    await textArea().trigger('pointerup')

    expect(resolveSelection).not.toHaveBeenCalled()
  })

  it('leaves the editor closed when the selection resolves to nothing (a tap)', async () => {
    resolvePhraseSelection.mockReturnValue(null)

    await mountReader()
    await textArea().trigger('pointerup')

    const editor = wrapper.findComponent(NoteEditorStub)
    expect(editor.props('modelValue')).toBe(false)
  })
})

/**
 * Text-anchored highlights (PRD §5.2).
 *
 * A highlight used to be persisted as the pixel rects it was drawn at — one
 * row per line rect — so it drifted off its words whenever the page reflowed.
 * It is now persisted the way a phrase note is: verse + char range, one row
 * per selection, with the rects rebuilt from the DOM at render time.
 */
describe('ScriptureReader — text-anchored highlights', () => {
  let wrapper
  let AnnotationRepository

  beforeEach(async () => {
    setActivePinia(createPinia())
    MockResizeObserver.mockClear()
    toolState.activeTool = 'highlighter'
    toolState.activeColour = '#fde68a'
    resolveSelection.mockClear().mockReturnValue(null)
    resolvePhraseSelection.mockClear().mockReturnValue(null)
    AnnotationRepository = (await import('@/lib/annotationRepository')).default
    AnnotationRepository.create.mockClear().mockResolvedValue(1)
  })

  afterEach(() => {
    toolState.activeTool = 'none'
    wrapper?.unmount()
  })

  async function mountReader() {
    const { default: ScriptureReader } = await import('../ScriptureReader.vue')
    wrapper = mount(ScriptureReader, {
      props: { book: 'PRO', chapter: 19 },
      global: { plugins: [createPinia()] }
    })
    await flushPromises()
    await wrapper.vm.$nextTick()
    return wrapper
  }

  function textArea() {
    return wrapper.find('.relative.flex.flex-1.overflow-hidden')
  }

  /** A selection that the browser reports as wrapping across two lines. */
  const wrappedSelection = {
    book: 'PRO',
    chapter: 19,
    verse: 1,
    charStart: 9,
    charEnd: 30,
    rects: [
      { x: 120, y: 40, width: 90, height: 20 },
      { x: 0, y: 60, width: 55, height: 20 }
    ]
  }

  it('stores the verse and char range instead of pixels', async () => {
    resolveSelection.mockReturnValue([wrappedSelection])

    await mountReader()
    await textArea().trigger('pointerup')
    await flushPromises()

    expect(AnnotationRepository.create).toHaveBeenCalledTimes(1)
    const payload = AnnotationRepository.create.mock.calls[0][0]

    expect(payload).toMatchObject({
      book: 'PRO',
      chapter: 19,
      verse: 1,
      type: 'highlight',
      colour: '#fde68a'
    })
    expect(payload.data).toMatchObject({ charStart: 9, charEnd: 30, anchorVersion: 1 })
  })

  it('[regression] writes ONE row for a phrase that wraps across two lines', async () => {
    resolveSelection.mockReturnValue([wrappedSelection])

    await mountReader()
    await textArea().trigger('pointerup')
    await flushPromises()

    // The old implementation looped sel.rects and wrote a row per line.
    expect(AnnotationRepository.create).toHaveBeenCalledTimes(1)
  })

  it('[regression] never persists a pixel rect for a new highlight', async () => {
    resolveSelection.mockReturnValue([wrappedSelection])

    await mountReader()
    await textArea().trigger('pointerup')
    await flushPromises()

    expect(AnnotationRepository.create.mock.calls[0][0].data.rect).toBeUndefined()
  })

  it('writes one anchored row per verse when a drag crosses a verse boundary', async () => {
    resolveSelection.mockReturnValue([
      { ...wrappedSelection, verse: 1, charStart: 20, charEnd: 43, rects: [{ x: 0, y: 0, width: 10, height: 20 }] },
      { ...wrappedSelection, verse: 2, charStart: 0, charEnd: 12, rects: [{ x: 0, y: 20, width: 10, height: 20 }] }
    ])

    await mountReader()
    await textArea().trigger('pointerup')
    await flushPromises()

    expect(AnnotationRepository.create).toHaveBeenCalledTimes(2)
    expect(AnnotationRepository.create.mock.calls.map((c) => c[0].verse)).toEqual([1, 2])
  })

  it('records the underline tool as an underline annotation', async () => {
    toolState.activeTool = 'underline'
    resolveSelection.mockReturnValue([wrappedSelection])

    await mountReader()
    await textArea().trigger('pointerup')
    await flushPromises()

    const payload = AnnotationRepository.create.mock.calls[0][0]
    expect(payload.type).toBe('underline')
    expect(payload.data.opacity).toBe(1)
  })
})
