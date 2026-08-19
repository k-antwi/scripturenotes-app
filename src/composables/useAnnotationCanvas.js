import { ref } from 'vue'
import getStroke from 'perfect-freehand'
import { useToolStore, TOOLS } from '@/stores/tool'
import { useSettingsStore } from '@/stores/settings'

export function useAnnotationCanvas() {
  const tool = useToolStore()
  const settings = useSettingsStore()

  const points = ref([])
  const isDrawing = ref(false)
  const livePathData = ref('')

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

  return { isDrawing, livePathData, startStroke, extendStroke, endStroke }
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
