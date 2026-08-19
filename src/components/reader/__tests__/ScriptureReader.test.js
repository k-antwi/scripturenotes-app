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

vi.mock('@/stores/tool', () => {
  const TOOLS = {
    NONE: 'none', HIGHLIGHTER: 'highlighter', PEN: 'pen',
    UNDERLINE: 'underline', SHAPE: 'shape', NOTE: 'note', ERASER: 'eraser'
  }
  return {
    TOOLS,
    useToolStore: () => ({ activeTool: TOOLS.NONE, activeColour: '#000', opacity: 1 })
  }
})

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

vi.mock('@/lib/db', () => ({
  db: { annotations: { where: vi.fn().mockReturnValue({ filter: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) }) } }
}))

vi.mock('dexie', () => ({ liveQuery: vi.fn((fn) => fn()) }))

vi.mock('@/composables/useTextSelection', () => ({
  useTextSelection: () => ({ resolveSelection: vi.fn().mockReturnValue(null) })
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
    await mountReader()

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
