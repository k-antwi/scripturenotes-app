<script setup>
import { ref, computed, watch } from 'vue'
import { useToolStore, TOOLS } from '@/stores/tool'
import { useAnnotationCanvas, hitTestHighlight } from '@/composables/useAnnotationCanvas'

const props = defineProps({
  annotations: { type: Array, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  // FIX: receives the scroll position of the text container so the canvas
  // stage can translate its coordinate system to match scrolled content.
  scrollTop: { type: Number, default: 0 },
  // Live geometry for highlight/underline annotations, re-derived from each
  // annotation's verse + char anchor by lib/highlightGeometry.js. Passing it
  // in (rather than reading a.data.rect here) is what keeps a highlight on its
  // words when the text reflows at a different screen size or font size.
  // Null means "no live geometry available" — fall back to the stored rects.
  highlightBoxes: { type: Array, default: null },
  // When true: canvas accepts pointer events for drawing (Pen/Shape/Eraser).
  // When false: pointer-events:none lets text selection fall through to the DOM.
  drawMode: { type: Boolean, default: false }
})

const emit = defineEmits(['pen-stroke-end', 'shape-stroke-end', 'erase'])

// ─── Highlight hit-test for eraser ────────────────────────────────────────────
// When the user taps with the eraser on the Konva stage background, check
// whether the tap position overlaps any highlight/underline annotation and
// emit 'erase' for the first match.  Highlights are rendered as HTML divs
// (not Konva shapes) so they need their own hit-testing path.
function onBackgroundClick(konvaEvt) {
  if (tool.activeTool !== TOOLS.ERASER) return
  const coords = getNativeCoords(konvaEvt)
  const container = stageRef.value.getStage().container()
  const rect = container.getBoundingClientRect()
  const x = coords.clientX - rect.left
  // Add scrollTop back because stored rect coords are in full-scroll space
  const y = coords.clientY - rect.top + props.scrollTop

  const target = hitTestHighlight(highlightLayer.value, x, y)
  if (target) emit('erase', target.localIds ?? target.localId)
}

const tool = useToolStore()
const stageRef = ref(null)
const {
  livePathData, startStroke, extendStroke, endStroke,
  liveShapePoints, startShape, extendShape, endShape
} = useAnnotationCanvas()

// Prefer the live, text-anchored geometry. The fallback keeps this component
// usable on its own (and renders records that predate the char anchor) by
// reading the rect frozen into each annotation at the time it was drawn.
const highlightLayer = computed(() => {
  if (props.highlightBoxes) return props.highlightBoxes
  return props.annotations
    .filter((a) => a.type === 'highlight' || a.type === 'underline')
    .filter((a) => a.data?.rect)
    .map((a) => ({
      key: `stored:${a.localId}`,
      localIds: [a.localId],
      type: a.type,
      colour: a.colour,
      opacity: a.data?.opacity ?? (a.type === 'underline' ? 1 : 0.35),
      rect: a.data.rect
    }))
})
const drawingAnnotations = computed(() =>
  props.annotations.filter((a) => a.type === 'pen' || a.type === 'shape')
)

// ─── Pen / drawing events ─────────────────────────────────────────────────────
// FIX: Konva events wrap the native event in evt.evt.
// Touch events don't have clientX — read from touches[0].
function getNativeCoords(konvaEvt) {
  const native = konvaEvt.evt
  if (native.touches && native.touches.length > 0) {
    return { clientX: native.touches[0].clientX, clientY: native.touches[0].clientY, pressure: 0.5 }
  }
  return { clientX: native.clientX, clientY: native.clientY, pressure: native.pressure ?? 0.5 }
}

function onPointerDown(konvaEvt) {
  if (!props.drawMode) return
  // Prevent the browser from scrolling or selecting text while drawing.
  // Must be called on the native event (konvaEvt.evt), not the Konva wrapper —
  // the Konva event object has no preventDefault(), which caused the TypeError.
  konvaEvt.evt?.preventDefault?.()
  const coords = getNativeCoords(konvaEvt)
  const container = stageRef.value.getStage().container()
  if (tool.activeTool === TOOLS.PEN) {
    startStroke(coords, container)
  } else if (tool.activeTool === TOOLS.SHAPE) {
    startShape(coords, container)
  }
}

function onPointerMove(konvaEvt) {
  if (!props.drawMode) return
  konvaEvt.evt?.preventDefault?.()
  const coords = getNativeCoords(konvaEvt)
  const container = stageRef.value.getStage().container()
  if (tool.activeTool === TOOLS.PEN) {
    extendStroke(coords, container)
  } else if (tool.activeTool === TOOLS.SHAPE) {
    extendShape(coords, container)
  }
}

function onPointerUp() {
  if (!props.drawMode) return
  if (tool.activeTool === TOOLS.PEN) {
    const stroke = endStroke({ canvasWidth: props.width, canvasHeight: props.height })
    if (stroke) emit('pen-stroke-end', stroke)
  } else if (tool.activeTool === TOOLS.SHAPE) {
    const shape = endShape({ canvasWidth: props.width, canvasHeight: props.height })
    if (shape) emit('shape-stroke-end', shape)
  }
}

function onAnnotationClick(localId) {
  if (tool.activeTool === TOOLS.ERASER) emit('erase', localId)
}

function pointsToFlatArray(points) {
  return points.flatMap(([x, y]) => [x, y])
}
</script>

<template>
  <div
    class="absolute inset-0 overflow-hidden"
    :style="{ pointerEvents: drawMode ? 'auto' : 'none' }"
  >
    <!--
      Highlights layer — positioned in the same coordinate space as the
      scrollable text.  The scrollTop offset is applied so highlights stay
      locked to their verse text as the user scrolls.

      Rect values come from `highlightBoxes`, recomputed from each
      annotation's verse + char range whenever the text reflows, so a
      highlight tracks its words across screen sizes and font settings
      instead of staying pinned to the pixels it was drawn at.
    -->
    <div
      class="absolute inset-x-0 top-0"
      :style="{ transform: `translateY(-${scrollTop}px)`, height: `${height}px`, pointerEvents: 'none' }"
    >
      <div
        v-for="box in highlightLayer"
        :key="box.key"
        class="absolute rounded-[2px]"
        :style="{
          left: `${box.rect.x}px`,
          top: `${box.rect.y}px`,
          width: `${box.rect.width}px`,
          height: box.type === 'underline' ? '2px' : `${box.rect.height}px`,
          background: box.type === 'highlight' ? box.colour : 'transparent',
          borderBottom: box.type === 'underline' ? `2px solid ${box.colour}` : 'none',
          opacity: box.type === 'highlight' ? box.opacity : 1,
          marginTop: box.type === 'underline' ? `${box.rect.height - 2}px` : '0'
        }"
      />
    </div>

    <!--
      Drawing layer — Konva stage for pen strokes & shapes.
      The stage itself is viewport-sized; we translate the Konva layer
      by -scrollTop so strokes appear at their original drawn position.

      FIX: pointer-events must be 'none' when not in drawMode so the Konva
      <canvas> element doesn't swallow touch/mouse events needed by the
      highlight, underline and note tools.  CSS pointer-events:none on the
      parent div is NOT enough — the <canvas> child has pointer-events:auto
      by default and would still intercept events.
    -->
    <v-stage
      v-if="drawMode || drawingAnnotations.length > 0"
      ref="stageRef"
      :config="{ width, height: height }"
      class="absolute inset-0"
      :style="{ pointerEvents: drawMode ? 'auto' : 'none' }"
      @mousedown="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @touchstart="onPointerDown"
      @touchmove="onPointerMove"
      @touchend="onPointerUp"
    >
      <v-layer :config="{ y: -scrollTop }">
        <!--
          Background rect — catches eraser taps on the empty stage area so
          highlights / underlines (which are HTML divs, not Konva shapes) can
          also be erased via hit-testing in onBackgroundClick.
        -->
        <v-rect
          v-if="tool.activeTool === TOOLS.ERASER"
          :config="{ x: 0, y: scrollTop, width: props.width, height: props.height, fill: 'transparent', listening: true }"
          @click="onBackgroundClick"
          @tap="onBackgroundClick"
        />

        <!-- Saved pen strokes -->
        <v-path
          v-for="a in drawingAnnotations.filter((d) => d.type === 'pen')"
          :key="a.localId"
          :config="{
            data: a.data.svgPath,
            fill: a.colour,
            opacity: a.data.opacity ?? 1,
            listening: tool.activeTool === TOOLS.ERASER
          }"
          @click="() => onAnnotationClick(a.localId)"
          @tap="() => onAnnotationClick(a.localId)"
        />

        <!-- Saved freehand shapes — FIX: added listening + erase handlers -->
        <v-line
          v-for="a in drawingAnnotations.filter((d) => d.type === 'shape' && d.data.shapeType === 'freehand')"
          :key="a.localId"
          :config="{
            points: pointsToFlatArray(a.data.points ?? []),
            stroke: a.colour,
            strokeWidth: a.data.strokeWidth ?? 3,
            tension: 0.4,
            lineCap: 'round',
            closed: true,
            listening: tool.activeTool === TOOLS.ERASER
          }"
          @click="() => onAnnotationClick(a.localId)"
          @tap="() => onAnnotationClick(a.localId)"
        />

        <!-- Saved ellipses — FIX: added listening + erase handlers -->
        <v-ellipse
          v-for="a in drawingAnnotations.filter((d) => d.type === 'shape' && d.data.shapeType === 'ellipse')"
          :key="a.localId"
          :config="{
            x: a.data.boundingBox.x + a.data.boundingBox.width / 2,
            y: a.data.boundingBox.y + a.data.boundingBox.height / 2,
            radiusX: a.data.boundingBox.width / 2,
            radiusY: a.data.boundingBox.height / 2,
            stroke: a.colour,
            strokeWidth: 2.5,
            listening: tool.activeTool === TOOLS.ERASER
          }"
          @click="() => onAnnotationClick(a.localId)"
          @tap="() => onAnnotationClick(a.localId)"
        />

        <!-- Live in-progress pen stroke -->
        <v-path
          v-if="livePathData"
          :config="{ data: livePathData, fill: tool.activeColour, opacity: tool.opacity }"
        />

        <!-- Live in-progress freehand shape -->
        <v-line
          v-if="liveShapePoints.length > 1"
          :config="{
            points: pointsToFlatArray(liveShapePoints),
            stroke: tool.activeColour,
            strokeWidth: tool.strokeWidth,
            tension: 0.4,
            lineCap: 'round',
            closed: true,
            opacity: tool.opacity,
            dash: [6, 4]
          }"
        />
      </v-layer>
    </v-stage>
  </div>
</template>
