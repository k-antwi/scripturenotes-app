<script setup>
import { ref, computed, watch } from 'vue'
import { useToolStore, TOOLS } from '@/stores/tool'
import { useAnnotationCanvas } from '@/composables/useAnnotationCanvas'

const props = defineProps({
  annotations: { type: Array, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  // FIX: receives the scroll position of the text container so the canvas
  // stage can translate its coordinate system to match scrolled content.
  scrollTop: { type: Number, default: 0 },
  // When true: canvas accepts pointer events for drawing (Pen/Shape/Eraser).
  // When false: pointer-events:none lets text selection fall through to the DOM.
  drawMode: { type: Boolean, default: false }
})

const emit = defineEmits(['pen-stroke-end', 'shape-stroke-end', 'erase'])

const tool = useToolStore()
const stageRef = ref(null)
const {
  livePathData, startStroke, extendStroke, endStroke,
  liveShapePoints, startShape, extendShape, endShape
} = useAnnotationCanvas()

const highlightAnnotations = computed(() =>
  props.annotations.filter((a) => a.type === 'highlight' || a.type === 'underline')
)
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
    -->
    <div
      class="absolute inset-x-0 top-0"
      :style="{ transform: `translateY(-${scrollTop}px)`, height: `${height}px`, pointerEvents: 'none' }"
    >
      <div
        v-for="a in highlightAnnotations"
        :key="a.localId"
        class="absolute rounded-[2px]"
        :style="{
          left: `${a.data.rect?.x ?? 0}px`,
          top: `${a.data.rect?.y ?? 0}px`,
          width: `${a.data.rect?.width ?? 0}px`,
          height: a.type === 'underline' ? '2px' : `${a.data.rect?.height ?? 0}px`,
          background: a.type === 'highlight' ? a.colour : 'transparent',
          borderBottom: a.type === 'underline' ? `2px solid ${a.colour}` : 'none',
          opacity: a.type === 'highlight' ? (a.data.opacity ?? 0.35) : 1,
          marginTop: a.type === 'underline' ? `${(a.data.rect?.height ?? 0) - 2}px` : '0'
        }"
      />
    </div>

    <!--
      Drawing layer — Konva stage for pen strokes & shapes.
      The stage itself is viewport-sized; we translate the Konva layer
      by -scrollTop so strokes appear at their original drawn position.
    -->
    <v-stage
      v-if="drawMode || drawingAnnotations.length > 0"
      ref="stageRef"
      :config="{ width, height: height }"
      class="absolute inset-0"
      @mousedown="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @touchstart.prevent="onPointerDown"
      @touchmove.prevent="onPointerMove"
      @touchend="onPointerUp"
    >
      <v-layer :config="{ y: -scrollTop }">
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

        <!-- Saved freehand shapes -->
        <v-line
          v-for="a in drawingAnnotations.filter((d) => d.type === 'shape' && d.data.shapeType === 'freehand')"
          :key="a.localId"
          :config="{
            points: pointsToFlatArray(a.data.points ?? []),
            stroke: a.colour,
            strokeWidth: a.data.strokeWidth ?? 3,
            tension: 0.4,
            lineCap: 'round',
            closed: true
          }"
        />

        <!-- Saved ellipses -->
        <v-ellipse
          v-for="a in drawingAnnotations.filter((d) => d.type === 'shape' && d.data.shapeType === 'ellipse')"
          :key="a.localId"
          :config="{
            x: a.data.boundingBox.x + a.data.boundingBox.width / 2,
            y: a.data.boundingBox.y + a.data.boundingBox.height / 2,
            radiusX: a.data.boundingBox.width / 2,
            radiusY: a.data.boundingBox.height / 2,
            stroke: a.colour,
            strokeWidth: 2.5
          }"
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
