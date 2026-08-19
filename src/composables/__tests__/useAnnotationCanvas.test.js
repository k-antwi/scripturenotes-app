/**
 * Unit tests for the shape-drawing additions in useAnnotationCanvas.
 *
 * Run with:  npx vitest run src/composables/__tests__/useAnnotationCanvas.test.js
 *
 * Requires:  npm install -D vitest @vue/test-utils
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('perfect-freehand', () => ({
  default: () => [[0, 0], [1, 1], [2, 2]]
}))

vi.mock('@/stores/tool', () => {
  const TOOLS = {
    NONE: 'none',
    HIGHLIGHTER: 'highlighter',
    PEN: 'pen',
    UNDERLINE: 'underline',
    SHAPE: 'shape',
    NOTE: 'note',
    ERASER: 'eraser'
  }
  return {
    TOOLS,
    useToolStore: () => ({
      activeTool: TOOLS.SHAPE,
      activeColour: '#3B6FE0',
      strokeWidth: 3,
      opacity: 1
    })
  }
})

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    penFeel: { thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
  })
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Fake canvas element whose bounding rect starts at (10, 20). */
function makeCanvas(left = 10, top = 20) {
  return { getBoundingClientRect: () => ({ left, top }) }
}

function makeCoords(clientX, clientY, pressure = 0.5) {
  return { clientX, clientY, pressure }
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('useAnnotationCanvas — shape drawing', () => {
  let startShape, extendShape, endShape, liveShapePoints

  beforeEach(async () => {
    setActivePinia(createPinia())
    // Re-import each test so Vue refs are fresh
    const mod = await import('../useAnnotationCanvas')
    ;({ startShape, extendShape, endShape, liveShapePoints } =
      mod.useAnnotationCanvas())
  })

  it('startShape initialises liveShapePoints with the first point', () => {
    const canvas = makeCanvas(0, 0)
    startShape(makeCoords(50, 80), canvas)
    expect(liveShapePoints.value).toEqual([[50, 80]])
  })

  it('extendShape appends points and updates liveShapePoints reactively', () => {
    const canvas = makeCanvas(0, 0)
    startShape(makeCoords(10, 10), canvas)
    extendShape(makeCoords(20, 20), canvas)
    extendShape(makeCoords(30, 30), canvas)
    expect(liveShapePoints.value).toHaveLength(3)
    expect(liveShapePoints.value[2]).toEqual([30, 30])
  })

  it('extendShape is a no-op before startShape is called', () => {
    const canvas = makeCanvas(0, 0)
    extendShape(makeCoords(50, 50), canvas)
    expect(liveShapePoints.value).toHaveLength(0)
  })

  it('endShape returns null and resets when fewer than 3 points collected', () => {
    const canvas = makeCanvas(0, 0)
    startShape(makeCoords(10, 10), canvas)
    extendShape(makeCoords(20, 20), canvas)
    const result = endShape({ canvasWidth: 400, canvasHeight: 800 })
    expect(result).toBeNull()
    expect(liveShapePoints.value).toHaveLength(0)
  })

  it('endShape returns a well-formed shape annotation payload', () => {
    const canvas = makeCanvas(0, 0)
    startShape(makeCoords(10, 10), canvas)
    extendShape(makeCoords(20, 30), canvas)
    extendShape(makeCoords(15, 40), canvas)
    const result = endShape({ canvasWidth: 400, canvasHeight: 800 })

    expect(result).not.toBeNull()
    expect(result.type).toBe('shape')
    expect(result.data.shapeType).toBe('freehand')
    expect(Array.isArray(result.data.points)).toBe(true)
    expect(result.data.points.length).toBeGreaterThanOrEqual(3)
    expect(result.data.strokeWidth).toBeTypeOf('number')
    expect(result.canvasWidth).toBe(400)
    expect(result.canvasHeight).toBe(800)
  })

  it('endShape resets state so a second shape starts clean', () => {
    const canvas = makeCanvas(0, 0)
    startShape(makeCoords(5, 5), canvas)
    extendShape(makeCoords(10, 10), canvas)
    extendShape(makeCoords(15, 15), canvas)
    endShape({ canvasWidth: 400, canvasHeight: 800 })

    // Second shape
    startShape(makeCoords(100, 100), canvas)
    expect(liveShapePoints.value).toEqual([[100, 100]])
  })

  it('canvas bounding rect offset is subtracted from clientX/Y', () => {
    const canvas = makeCanvas(10, 20) // left=10, top=20
    startShape(makeCoords(60, 80), canvas)
    // Expected: [60-10, 80-20] = [50, 60]
    expect(liveShapePoints.value[0]).toEqual([50, 60])
  })
})
