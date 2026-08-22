import { ref } from 'vue'
import getStroke from 'perfect-freehand'
import { useToolStore, TOOLS } from '@/stores/tool'
import { useSettingsStore } from '@/stores/settings'

export function useAnnotationCanvas() {
  const tool = useToolStore()
  const settings = useSettingsStore()

  // ── Pen stroke state ──────────────────────────────────────────────────────
  const points = ref([])
  const isDrawing = ref(false)
  const livePathData = ref('')

  // ── Shape (freehand lasso) state ──────────────────────────────────────────
  const shapePoints = ref([])
  const isDrawingShape = ref(false)
  const liveShapePoints = ref([])

  // FIX: accept a coords object { clientX, clientY, pressure } instead of a
  // full PointerEvent — works for both mouse and touch (Konva wraps them
  // differently and touch events have no top-level clientX).
  //
  // FIX (scroll offset): the Konva stage container is pinned to the top of
  // the reader column, so `clientY - rect.top` is a VIEWPORT offset. Every
  // annotation is stored in SCROLL space (see saveHighlight, which adds
  // scrollTop to each rect) and the drawing layer is rendered with
  // `y: -scrollTop`. Without adding scrollTop back here, a stroke drawn on a
  // scrolled chapter was stored — and drawn live — scrollTop pixels above the
  // pointer, so circling a word circled the line above it.
  function coordsToTriple(coords, canvasEl, scrollTop = 0) {
    const rect = canvasEl.getBoundingClientRect()
    const x = coords.clientX - rect.left
    const y = coords.clientY - rect.top + scrollTop
    const pressure = coords.pressure > 0 ? coords.pressure : 0.5
    return [x, y, pressure]
  }

  // Returns just [x, y] — shape points don't need pressure.
  function coordsToPoint(coords, canvasEl, scrollTop = 0) {
    const [x, y] = coordsToTriple(coords, canvasEl, scrollTop)
    return [x, y]
  }

  function startStroke(coords, canvasEl, scrollTop = 0) {
    if (tool.activeTool !== TOOLS.PEN) return
    isDrawing.value = true
    points.value = [coordsToTriple(coords, canvasEl, scrollTop)]
    livePathData.value = ''
  }

  function extendStroke(coords, canvasEl, scrollTop = 0) {
    if (!isDrawing.value) return
    points.value.push(coordsToTriple(coords, canvasEl, scrollTop))
    livePathData.value = computePath()
  }

  function endStroke({ canvasWidth, canvasHeight }) {
    isDrawing.value = false
    if (points.value.length < 3) {
      points.value = []
      livePathData.value = ''
      return null
    }

    const svgPath = computePath()

    const annotation = {
      type: 'pen',
      colour: tool.activeColour,
      strokeWidth: tool.strokeWidth,
      opacity: tool.opacity,
      points: points.value,
      svgPath,
      canvasWidth,
      canvasHeight
    }

    points.value = []
    livePathData.value = ''
    return annotation
  }

  function computePath() {
    if (points.value.length < 2) return ''
    const outline = getStroke(points.value, {
      // Multiplier of 2 gives a range of 3px (fine) to 18px (brush) —
      // enough contrast between settings without making "fine" look chunky.
      size: tool.strokeWidth * 2,
      thinning: settings.penFeel.thinning,
      smoothing: settings.penFeel.smoothing,
      streamline: settings.penFeel.streamline,
      simulatePressure: false,
      last: true
    })
    return outlineToSvgPath(outline)
  }

  // ── Shape (freehand lasso) ────────────────────────────────────────────────
  function startShape(coords, canvasEl, scrollTop = 0) {
    if (tool.activeTool !== TOOLS.SHAPE) return
    isDrawingShape.value = true
    const pt = coordsToPoint(coords, canvasEl, scrollTop)
    shapePoints.value = [pt]
    liveShapePoints.value = [pt]
  }

  function extendShape(coords, canvasEl, scrollTop = 0) {
    if (!isDrawingShape.value) return
    const pt = coordsToPoint(coords, canvasEl, scrollTop)
    shapePoints.value.push(pt)
    // Spread to trigger Vue reactivity on the array reference
    liveShapePoints.value = [...shapePoints.value]
  }

  function endShape({ canvasWidth, canvasHeight }) {
    isDrawingShape.value = false
    if (shapePoints.value.length < 3) {
      shapePoints.value = []
      liveShapePoints.value = []
      return null
    }

    const annotation = {
      type: 'shape',
      colour: tool.activeColour,
      opacity: tool.opacity,
      data: {
        shapeType: 'freehand',
        points: shapePoints.value,
        strokeWidth: tool.strokeWidth
      },
      canvasWidth,
      canvasHeight
    }

    shapePoints.value = []
    liveShapePoints.value = []
    return annotation
  }

  return {
    // pen
    isDrawing, livePathData, startStroke, extendStroke, endStroke,
    // shape
    isDrawingShape, liveShapePoints, startShape, extendShape, endShape
  }
}

/**
 * Pure hit-test helper — returns the first highlight/underline annotation
 * whose stored rect contains the point (x, y) in scroll-space, or null.
 *
 * Exported so it can be unit-tested independently of the canvas component.
 */
export function hitTestHighlight(annotations, x, y) {
  if (!Array.isArray(annotations)) return null
  return annotations.find((a) => {
    if (a.type !== 'highlight' && a.type !== 'underline') return false
    const r = a.data?.rect
    if (!r) return false
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height
  }) ?? null
}

function outlineToSvgPath(pts) {
  if (!pts.length) return ''
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} `
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = ((x0 + x1) / 2).toFixed(1)
    const my = ((y0 + y1) / 2).toFixed(1)
    d += `Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${mx} ${my} `
  }
  d += 'Z'
  return d
}
