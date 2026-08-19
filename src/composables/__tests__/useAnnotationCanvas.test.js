/**
 * Unit tests for useAnnotationCanvas — pen strokes, shape drawing, and regressions.
 *
 * Run with:  npx vitest run src/composables/__tests__/useAnnotationCanvas.test.js
 *
 * Requires:  npm install -D vitest @vue/test-utils
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mocks ─────────────────────────────────────────────────────────────────────
vi.mock('perfect-freehand', () => ({
  default: () => [[0, 0], [10, 5], [20, 0]]
}))

const TOOLS = {
  NONE: 'none',
  HIGHLIGHTER: 'highlighter',
  PEN: 'pen',
  UNDERLINE: 'underline',
  SHAPE: 'shape',
  NOTE: 'note',
  ERASER: 'eraser'
}

// activeTool is mutated per describe block via the factory below
let mockActiveTool = TOOLS.PEN
vi.mock('@/stores/tool', () => ({
  TOOLS,
  useToolStore: () => ({
    get activeTool() { return mockActiveTool },
    activeColour: '#3B6FE0',
    strokeWidth: 3,
    opacity: 1
  })
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    penFeel: { thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
  })
}))

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Fake canvas element whose bounding rect starts at (left, top). */
function makeCanvas(left = 0, top = 0) {
  return { getBoundingClientRect: () => ({ left, top }) }
}

function makeCoords(clientX, clientY, pressure = 0.5) {
  return { clientX, clientY, pressure }
}

async function freshComposable() {
  setActivePinia(createPinia())
  // vi.resetModules() ensures Vue refs are fresh for each test
  vi.resetModules()
  const mod = await import('../useAnnotationCanvas')
  return mod.useAnnotationCanvas()
}

// ── Pen stroke tests ──────────────────────────────────────────────────────────
describe('useAnnotationCanvas — pen strokes', () => {
  beforeEach(() => { mockActiveTool = TOOLS.PEN })

  it('startStroke initialises isDrawing and records first point', async () => {
    const { startStroke, isDrawing, livePathData } = await freshComposable()
    startStroke(makeCoords(10, 20), makeCanvas())
    expect(isDrawing.value).toBe(true)
    expect(livePathData.value).toBe('') // no path until extendStroke
  })

  it('extendStroke builds a live SVG path after two points', async () => {
    const { startStroke, extendStroke, livePathData } = await freshComposable()
    const canvas = makeCanvas()
    startStroke(makeCoords(0, 0), canvas)
    extendStroke(makeCoords(50, 50), canvas)
    expect(livePathData.value.length).toBeGreaterThan(0)
    expect(livePathData.value.startsWith('M')).toBe(true)
  })

  it('endStroke returns null and resets when fewer than 3 points', async () => {
    const { startStroke, extendStroke, endStroke, livePathData } = await freshComposable()
    const canvas = makeCanvas()
    startStroke(makeCoords(0, 0), canvas)
    extendStroke(makeCoords(10, 10), canvas)
    const result = endStroke({ canvasWidth: 400, canvasHeight: 800 })
    expect(result).toBeNull()
    expect(livePathData.value).toBe('')
  })

  it('endStroke returns a well-formed pen annotation payload', async () => {
    const { startStroke, extendStroke, endStroke } = await freshComposable()
    const canvas = makeCanvas()
    startStroke(makeCoords(0, 0), canvas)
    extendStroke(makeCoords(20, 30), canvas)
    extendStroke(makeCoords(40, 10), canvas)
    const result = endStroke({ canvasWidth: 500, canvasHeight: 900 })

    expect(result).not.toBeNull()
    expect(result.type).toBe('pen')
    expect(typeof result.svgPath).toBe('string')
    expect(result.svgPath.startsWith('M')).toBe(true)
    expect(result.canvasWidth).toBe(500)
    expect(result.canvasHeight).toBe(900)
  })

  it('endStroke resets state so a second stroke starts clean', async () => {
    const { startStroke, extendStroke, endStroke, livePathData } = await freshComposable()
    const canvas = makeCanvas()
    startStroke(makeCoords(0, 0), canvas)
    extendStroke(makeCoords(10, 10), canvas)
    extendStroke(makeCoords(20, 20), canvas)
    endStroke({ canvasWidth: 400, canvasHeight: 800 })

    expect(livePathData.value).toBe('')
    // Starting a second stroke should not inherit previous points
    startStroke(makeCoords(100, 100), canvas)
    extendStroke(makeCoords(110, 110), canvas)
    // Only 2 points → endStroke returns null (confirms no leftover points)
    expect(endStroke({ canvasWidth: 400, canvasHeight: 800 })).toBeNull()
  })

  // ── REGRESSION: pen events ignored when activeTool is not PEN ─────────────
  it('[regression] startStroke is a no-op when activeTool is not PEN', async () => {
    mockActiveTool = TOOLS.SHAPE
    const { startStroke, isDrawing } = await freshComposable()
    startStroke(makeCoords(10, 10), makeCanvas())
    expect(isDrawing.value).toBe(false)
  })
})

// ── Shape drawing tests ───────────────────────────────────────────────────────
describe('useAnnotationCanvas — shape drawing', () => {
  let startShape, extendShape, endShape, liveShapePoints

  beforeEach(async () => {
    mockActiveTool = TOOLS.SHAPE
    ;({ startShape, extendShape, endShape, liveShapePoints } = await freshComposable())
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

  // ── REGRESSION: shape events ignored when activeTool is not SHAPE ──────────
  it('[regression] startShape is a no-op when activeTool is not SHAPE', async () => {
    mockActiveTool = TOOLS.PEN
    ;({ startShape, liveShapePoints } = await freshComposable())
    startShape(makeCoords(10, 10), makeCanvas())
    expect(liveShapePoints.value).toHaveLength(0)
  })

  // ── REGRESSION: extendShape does not accumulate across separate gestures ───
  it('[regression] extendShape called without a preceding startShape never accumulates', async () => {
    extendShape(makeCoords(10, 10), makeCanvas())
    extendShape(makeCoords(20, 20), makeCanvas())
    extendShape(makeCoords(30, 30), makeCanvas())
    expect(liveShapePoints.value).toHaveLength(0)
    // endShape should return null — no orphaned points to persist
    expect(endShape({ canvasWidth: 400, canvasHeight: 800 })).toBeNull()
  })
})
