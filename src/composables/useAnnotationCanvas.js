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
  function coordsToTriple(coords, canvasEl) {
    const rect = canvasEl.getBoundingClientRect()
    const x = coords.clientX - rect.left
    const y = coords.clientY - rect.top
    const pressure = coords.pressure > 0 ? coords.pressure : 0.5
    return [x, y, pressure]
  }

  // Returns just [x, y] — shape points don't need pressure.
  function coordsToPoint(coords, canvasEl) {
    const [x, y] = coordsToTriple(coords, canvasEl)
    return [x, y]
  }

  function startStroke(coords, canvasEl) {
    if (tool.activeTool !== TOOLS.PEN) return
    isDrawing.value = true
    points.value = [coordsToTriple(coords, canvasEl)]
    livePathData.value = ''
  }

  function extendStroke(coords, canvasEl) {
    if (!isDrawing.value) return
    points.value.push(coordsToTriple(coords, canvasEl))
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
      size: tool.strokeWidth * 4,
      thinning: settings.penFeel.thinning,
      smoothing: settings.penFeel.smoothing,
      streamline: settings.penFeel.streamline,
      simulatePressure: false,
      last: true
    })
    return outlineToSvgPath(outline)
  }

  // ── Shape (freehand lasso) ────────────────────────────────────────────────
  function startShape(coords, canvasEl) {
    if (tool.activeTool !== TOOLS.SHAPE) return
    isDrawingShape.value = true
    const pt = coordsToPoint(coords, canvasEl)
    shapePoints.value = [pt]
    liveShapePoints.value = [pt]
  }

  function extendShape(coords, canvasEl) {
    if (!isDrawingShape.value) return
    const pt = coordsToPoint(coords, canvasEl)
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
