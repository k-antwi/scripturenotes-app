<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { PassageRepository } from '@/lib/passageRepository'
import AnnotationRepository from '@/lib/annotationRepository'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useToolStore, TOOLS } from '@/stores/tool'
import { useTextSelection } from '@/composables/useTextSelection'
import { useObservable } from '@/composables/useObservable'
import { useStudySession } from '@/composables/useStudySession'
import VerseBlock from './VerseBlock.vue'
import TranslationSelector from './TranslationSelector.vue'
import ChapterNav from './ChapterNav.vue'
import AnnotationCanvas from '@/components/annotation/AnnotationCanvas.vue'
import AnnotationToolbar from '@/components/annotation/AnnotationToolbar.vue'
import NoteModal from '@/components/annotation/NoteModal.vue'
import StudyNotesPanel from '@/components/notes/StudyNotesPanel.vue'
import { Sheet } from '@/components/ui/sheet'

const props = defineProps({
  book: { type: String, required: true },
  chapter: { type: Number, required: true }
})

const auth = useAuthStore()
const settings = useSettingsStore()
const tool = useToolStore()

// containerRef is the scrollable text div — canvas is sized to match it
const containerRef = ref(null)
const canvasSize = ref({ width: 0, height: 0 })
const scrollTopRef = ref(0)
const passage = ref(null)
const studyNotes = ref(null)
const loading = ref(true)
const error = ref(null)
const translation = ref(settings.defaultTranslation)

// Live annotations from Dexie — canvas re-renders on every write
const annotations = useObservable(
  () => liveQuery(() =>
    db.annotations
      .where({ book: props.book, chapter: props.chapter })
      .filter((a) => !a.deletedAt)
      .toArray()
  ),
  [],
  [() => props.book, () => props.chapter]
)

// Text-tool selection resolver (highlight / underline)
const { resolveSelection } = useTextSelection(containerRef)

// Typed note modal state
const noteModalOpen = ref(false)
const noteTargetVerse = ref(null)

// Study notes panel state
const notesSheetOpen = ref(false)
const notesTargetVerse = ref(null)

// ─── Scroll tracking ──────────────────────────────────────────────────────────
// Keep scrollTop reactive so the canvas layer stays in sync as the user scrolls
function onScroll() {
  scrollTopRef.value = containerRef.value?.scrollTop ?? 0
}

// ─── Passage loading ─────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  error.value = null
  try {
    passage.value = await PassageRepository.get(props.book, props.chapter, translation.value)
    // measureCanvas() is NOT called here — containerRef is still null because
    // `loading` is true and the content div is hidden behind v-else.
    // The containerRef watcher below handles sizing once the div mounts.
  } catch (e) {
    error.value = 'Could not load this passage. Please check your connection.'
  } finally {
    loading.value = false
  }
  // Study notes are supplementary — fetch separately so a 404 or network error
  // never prevents the passage itself from rendering.
  try {
    studyNotes.value = await PassageRepository.getNotes(props.book, props.chapter, translation.value)
  } catch {
    studyNotes.value = null
  }
}

watch([() => props.book, () => props.chapter, translation], load, { immediate: true })

// ─── Canvas sizing ────────────────────────────────────────────────────────────
// FIX: use scrollHeight so the canvas covers the full scrollable content height,
// not just the visible viewport height.  Without this pen strokes on lower parts
// of the chapter are clipped / mis-positioned.
function measureCanvas() {
  if (!containerRef.value) return
  canvasSize.value = {
    width: containerRef.value.offsetWidth,
    height: containerRef.value.scrollHeight
  }
}

const resizeObserver = new ResizeObserver(measureCanvas)

// FIX: containerRef lives inside a v-else block that only renders once `loading`
// is false. At onMounted, loading is still true so containerRef.value is null and
// observe() is never called, leaving canvasSize at { width:0, height:0 }.
// Watching containerRef directly ensures we start observing (and measure once)
// the moment the element actually enters the DOM, regardless of when that happens.
watch(containerRef, (el, prevEl) => {
  if (prevEl) resizeObserver.unobserve(prevEl)
  if (el) {
    resizeObserver.observe(el)
    measureCanvas()
  }
})
onUnmounted(() => resizeObserver.disconnect())

// ─── Highlight / Underline ────────────────────────────────────────────────────
// FIX: the container is a scrollable div.  DOMRect coords from getClientRects()
// are viewport-relative, so we must add scrollTop to get coords relative to the
// full (scrolled) content — which is what the canvas is positioned against.
function onPointerUp(evt) {
  // Ignore if this came from a canvas pointer-down (pen mode)
  if (tool.activeTool === TOOLS.PEN) return
  // resolveSelection() returns one entry per verse touched by the drag —
  // a selection almost never stays inside a single verse since verses
  // render inline in one paragraph.
  const selections = resolveSelection()
  if (!selections) return
  saveHighlight(selections)
}

async function saveHighlight(selections) {
  const scrollTop = containerRef.value?.scrollTop ?? 0
  const scrollLeft = containerRef.value?.scrollLeft ?? 0

  for (const sel of selections) {
    for (const rect of sel.rects) {
      await AnnotationRepository.create({
        userId: auth.user?.id ?? 'local',
        book: sel.book,
        chapter: sel.chapter,
        verse: sel.verse,
        type: tool.activeTool === TOOLS.UNDERLINE ? 'underline' : 'highlight',
        colour: tool.activeColour,
        data: {
          charStart: sel.charStart,
          charEnd: sel.charEnd,
          // Offset by scroll so the highlight div renders in the right place
          rect: {
            x: rect.x + scrollLeft,
            y: rect.y + scrollTop,
            width: rect.width,
            height: rect.height
          },
          opacity: tool.activeTool === TOOLS.HIGHLIGHTER ? 0.35 : 1
        }
      })
    }
  }
}

// ─── Pen stroke ───────────────────────────────────────────────────────────────
async function onPenStrokeEnd(stroke) {
  await AnnotationRepository.create({
    userId: auth.user?.id ?? 'local',
    book: props.book,
    chapter: props.chapter,
    verse: null,
    type: 'pen',
    colour: stroke.colour,
    data: stroke
  })
}

// ─── Shape stroke ─────────────────────────────────────────────────────────────
async function onShapeStrokeEnd(shape) {
  await AnnotationRepository.create({
    userId: auth.user?.id ?? 'local',
    book: props.book,
    chapter: props.chapter,
    verse: null,
    type: 'shape',
    colour: shape.colour,
    data: shape
  })
}

// ─── Eraser ───────────────────────────────────────────────────────────────────
async function onErase(localId) {
  await AnnotationRepository.remove(localId)
}

// ─── Verse tap ────────────────────────────────────────────────────────────────
function onVerseTap(verseNumber) {
  // Don't open the notes sheet if a drawing/selection tool is active
  if ([TOOLS.PEN, TOOLS.HIGHLIGHTER, TOOLS.UNDERLINE, TOOLS.SHAPE, TOOLS.ERASER].includes(tool.activeTool)) return

  if (tool.activeTool === TOOLS.NOTE) {
    noteTargetVerse.value = verseNumber
    noteModalOpen.value = true
    return
  }
  // Default: show study notes for this verse
  notesTargetVerse.value = verseNumber
  notesSheetOpen.value = true
}

const passageReference = computed(() => passage.value?.reference ?? `${props.book} ${props.chapter}`)

useStudySession(() => passageReference.value)

const verses = computed(() => passage.value?.verses ?? [])
</script>

<template>
  <!--
    FIX: this wrapper must be position:relative so that the absolutely-positioned
    AnnotationToolbar (bottom-4 right-4) anchors inside the reader, not the
    viewport.  The canvas overlay also uses absolute inset-0 within containerRef.
  -->
  <div class="relative flex h-full flex-col overflow-hidden">
    <!-- Chapter nav header -->
    <ChapterNav
      :book="book"
      :chapter="chapter"
      :reference="passageReference"
      :chapter-count="passage?.totalChapters ?? 150"
    />

    <!-- Translation selector row -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
      <TranslationSelector v-model="translation" />
      <span class="text-xs text-muted-foreground ml-auto">
        {{ verses.length }} verse{{ verses.length === 1 ? '' : 's' }}
      </span>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted-foreground">
        <div class="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <p class="text-sm">Loading scripture…</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="flex flex-1 items-center justify-center p-6 text-center">
      <p class="text-sm text-muted-foreground">{{ error }}</p>
    </div>

    <!--
      Scripture text + canvas overlay.
      FIX: @pointerup lives here (not on the inner scroll div) so it fires
      even when the highlight-tool canvas layer is pointer-events-none.
    -->
    <div
      v-else
      class="relative flex-1 overflow-hidden"
      @pointerup="onPointerUp"
    >
      <!--
        Scrollable text area.  The canvas is a sibling positioned absolute
        so it does NOT scroll with the text — instead it covers the full
        scrollHeight of this div and moves with scrollTop.
      -->
      <div
        ref="containerRef"
        class="h-full overflow-y-auto"
        @scroll="onScroll"
        :class="[
          tool.activeTool === TOOLS.PEN || tool.activeTool === TOOLS.ERASER
            ? 'select-none'   // prevent text selection interfering with drawing
            : ''
        ]"
      >
        <!--
          Two-column layout on tablet/landscape (PRD §6.1 768px+ breakpoint).
          Single column on mobile portrait.
        -->
        <div
          class="relative z-0 px-4 py-5"
          :class="settings.twoColumnPreferred ? 'md:columns-2 md:gap-8' : ''"
        >
          <h1 class="font-scripture text-xl font-semibold text-foreground mb-6 break-after-avoid">
            {{ passageReference }}
          </h1>

          <p class="font-scripture">
            <VerseBlock
              v-for="verse in verses"
              :key="verse.number"
              :book="book"
              :chapter="chapter"
              :verse="verse"
              :font-size="settings.fontSize"
              :line-height="settings.lineHeight"
              @verse-tap="onVerseTap"
            />
          </p>
        </div>
      </div>

      <!--
        Canvas overlay — absolutely positioned over the scrollable div.
        FIX: pointer-events are NEVER captured for Highlighter/Underline —
        the native text selection must reach the DOM.  Only Pen/Eraser/Shape
        need pointer-events-auto on the canvas.
      -->
      <AnnotationCanvas
        :annotations="annotations"
        :width="canvasSize.width"
        :height="canvasSize.height"
        :scroll-top="scrollTopRef"
        class="absolute inset-0 z-10 pointer-events-none"
        :draw-mode="tool.activeTool === TOOLS.PEN || tool.activeTool === TOOLS.ERASER || tool.activeTool === TOOLS.SHAPE"
        @pen-stroke-end="onPenStrokeEnd"
        @shape-stroke-end="onShapeStrokeEnd"
        @erase="onErase"
      />
    </div>

    <!-- Floating annotation toolbar — anchored to this relative wrapper -->
    <AnnotationToolbar />

    <!-- Typed note modal -->
    <NoteModal
      v-model="noteModalOpen"
      :book="book"
      :chapter="chapter"
      :verse="noteTargetVerse"
    />

    <!-- Study notes panel — bottom sheet on mobile -->
    <Sheet v-model="notesSheetOpen" title="Study Notes" side="bottom">
      <StudyNotesPanel
        :notes="studyNotes"
        :target-verse="notesTargetVerse"
        @close="notesSheetOpen = false"
        @navigate-ref="notesSheetOpen = false"
      />
    </Sheet>
  </div>
</template>
