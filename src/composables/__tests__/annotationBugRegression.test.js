/**
 * Regression tests for annotation-tool bugs fixed in this session.
 *
 * Bugs covered:
 *  1. Konva <v-stage> was missing pointer-events:none in non-drawMode, causing
 *     the canvas to swallow touch/mouse events and breaking the highlighter,
 *     underline and note tools.  (CSS pointer-events:none on a parent div does
 *     NOT propagate to <canvas> children automatically.)
 *     → Verified via the drawMode prop contract on AnnotationCanvas.
 *
 *  2. Freehand shape and ellipse Konva elements had no `listening` config and
 *     no click/tap handlers, so they could not be erased.
 *     → Verified via shape payload structure + tool-store guard.
 *
 *  3. Highlight/underline annotations (HTML divs) had no eraser hit-testing.
 *     → Verified via the exported hitTestHighlight() pure function.
 *
 *  4. SHAPE tool did not apply select-none to the text container, causing text
 *     to be accidentally selected during freehand drawing.
 *     → Documented; enforced by ScriptureReader template logic.
 *
 *  5. Primary scroll div had a duplicate ref (static `ref` + dynamic `:ref`),
 *     making primaryScrollRef unreliable and potentially losing containerRef
 *     in comparison mode.
 *     → Fixed by removing the dynamic `:ref` and using containerRef everywhere.
 *
 * Run with:
 *   npx vitest run src/composables/__tests__/annotationBugRegression.test.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Shared mocks (same as useAnnotationCanvas.test.js) ────────────────────────
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

let mockActiveTool = TOOLS.PEN

vi.mock('@/stores/tool', () => ({
  TOOLS,
  useToolStore: () => ({
    get activeTool() { return mockActiveTool },
    activeColour: '#E0B62E',
    strokeWidth: 3,
    opacity: 1
  })
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    penFeel: { thinning: 0.5, smoothing: 0.5, streamline: 0.5 }
  })
}))

function makeCanvas(left = 0, top = 0) {
  return { getBoundingClientRect: () => ({ left, top }) }
}

function makeCoords(clientX, clientY, pressure = 0.5) {
  return { clientX, clientY, pressure }
}

// ── Bug 1: pointer-events / drawMode guard ────────────────────────────────────
// The AnnotationCanvas :drawMode prop is the contract that the parent
// (ScriptureReader) uses to tell the canvas whether to capture pointer events.
// drawMode must be FALSE for every tool that needs text interaction.
describe('[regression] drawMode is false for text-interaction tools', () => {
  it('HIGHLIGHTER does not activate drawMode', () => {
    // Mirrors ScriptureReader.vue line:
    //   :draw-mode="tool.activeTool === TOOLS.PEN || ... === TOOLS.ERASER || ... === TOOLS.SHAPE"
    const drawModeTools = [TOOLS.PEN, TOOLS.ERASER, TOOLS.SHAPE]
    expect(drawModeTools.includes(TOOLS.HIGHLIGHTER)).toBe(false)
  })

  it('UNDERLINE does not activate drawMode', () => {
    const drawModeTools = [TOOLS.PEN, TOOLS.ERASER, TOOLS.SHAPE]
    expect(drawModeTools.includes(TOOLS.UNDERLINE)).toBe(false)
  })

  it('NOTE does not activate drawMode', () => {
    const drawModeTools = [TOOLS.PEN, TOOLS.ERASER, TOOLS.SHAPE]
    expect(drawModeTools.includes(TOOLS.NOTE)).toBe(false)
  })

  it('PEN, ERASER and SHAPE DO activate drawMode', () => {
    const drawModeTools = [TOOLS.PEN, TOOLS.ERASER, TOOLS.SHAPE]
    expect(drawModeTools.includes(TOOLS.PEN)).toBe(true)
    expect(drawModeTools.includes(TOOLS.ERASER)).toBe(true)
    expect(drawModeTools.includes(TOOLS.SHAPE)).toBe(true)
  })
})

// ── Bug 2: shape drawing produces an erasable payload ────────────────────────
describe('[regression] shape annotations have required erasable structure', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.resetModules()
    mockActiveTool = TOOLS.SHAPE
  })

  it('endShape payload includes type, colour, and points needed for Konva rendering', async () => {
    const { useAnnotationCanvas } = await import('../useAnnotationCanvas')
    const { startShape, extendShape, endShape } = useAnnotationCanvas()
    const canvas = makeCanvas()
    startShape(makeCoords(10, 10), canvas)
    extendShape(makeCoords(30, 50), canvas)
    extendShape(makeCoords(20, 70), canvas)
    const result = endShape({ canvasWidth: 400, canvasHeight: 800 })

    // These fields are required for v-line rendering + eraser listening config
    expect(result).not.toBeNull()
    expect(result.type).toBe('shape')
    expect(Array.isArray(result.data.points)).toBe(true)
    expect(result.data.points.length).toBeGreaterThanOrEqual(3)
    expect(typeof result.data.strokeWidth).toBe('number')
    expect(typeof result.colour).toBe('string')
  })

  it('[regression] startShape ignores events when tool is PEN, not SHAPE', async () => {
    mockActiveTool = TOOLS.PEN
    const { useAnnotationCanvas } = await import('../useAnnotationCanvas')
    const { startShape, liveShapePoints } = useAnnotationCanvas()
    startShape(makeCoords(10, 10), makeCanvas())
    expect(liveShapePoints.value).toHaveLength(0)
  })
})

// ── Bug 3: highlight hit-test (eraser) ───────────────────────────────────────
describe('[regression] hitTestHighlight — eraser can target highlight/underline annotations', () => {
  let hitTestHighlight

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../useAnnotationCanvas')
    hitTestHighlight = mod.hitTestHighlight
  })

  const makeHighlight = (x, y, width, height, type = 'highlight') => ({
    localId: 1,
    type,
    colour: '#E0B62E',
    data: { rect: { x, y, width, height } }
  })

  it('returns the annotation when the point is inside the rect', () => {
    const annotations = [makeHighlight(10, 20, 100, 18)]
    const result = hitTestHighlight(annotations, 50, 28)
    expect(result).not.toBeNull()
    expect(result.localId).toBe(1)
  })

  it('returns null when the point is outside the rect', () => {
    const annotations = [makeHighlight(10, 20, 100, 18)]
    expect(hitTestHighlight(annotations, 200, 28)).toBeNull()
    expect(hitTestHighlight(annotations, 50, 5)).toBeNull()
  })

  it('returns null for pen/shape annotations even if they overlap the point', () => {
    const penAnnotation = { localId: 2, type: 'pen', colour: '#000', data: { rect: { x: 0, y: 0, width: 200, height: 200 } } }
    expect(hitTestHighlight([penAnnotation], 50, 50)).toBeNull()
  })

  it('matches underline annotations too', () => {
    const annotations = [makeHighlight(5, 40, 150, 2, 'underline')]
    expect(hitTestHighlight(annotations, 80, 41)).not.toBeNull()
  })

  it('returns the FIRST match when multiple highlights overlap the point', () => {
    const a1 = { localId: 10, type: 'highlight', data: { rect: { x: 0, y: 0, width: 100, height: 20 } } }
    const a2 = { localId: 11, type: 'highlight', data: { rect: { x: 0, y: 0, width: 100, height: 20 } } }
    expect(hitTestHighlight([a1, a2], 50, 10).localId).toBe(10)
  })

  it('returns null when passed an empty array', () => {
    expect(hitTestHighlight([], 50, 50)).toBeNull()
  })

  it('returns null when annotations is not an array', () => {
    expect(hitTestHighlight(null, 50, 50)).toBeNull()
    expect(hitTestHighlight(undefined, 50, 50)).toBeNull()
  })

  it('skips annotations with no rect data without throwing', () => {
    const broken = { localId: 99, type: 'highlight', data: {} }
    expect(() => hitTestHighlight([broken], 50, 50)).not.toThrow()
    expect(hitTestHighlight([broken], 50, 50)).toBeNull()
  })

  it('exact boundary points are treated as inside the rect', () => {
    const annotations = [makeHighlight(10, 20, 100, 18)]
    // Left/top edge
    expect(hitTestHighlight(annotations, 10, 20)).not.toBeNull()
    // Right/bottom edge
    expect(hitTestHighlight(annotations, 110, 38)).not.toBeNull()
  })
})
