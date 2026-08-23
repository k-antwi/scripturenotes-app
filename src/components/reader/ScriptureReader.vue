<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { PassageRepository } from '@/lib/passageRepository'
import AnnotationRepository from '@/lib/annotationRepository'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useToolStore, TOOLS } from '@/stores/tool'
import { useUndoRedoStore } from '@/stores/undoRedo'
import { usePdfExport } from '@/composables/usePdfExport'
import { useTextSelection } from '@/composables/useTextSelection'
import { extractPhrase } from '@/lib/verseSegments'
import { buildHighlightBoxes } from '@/lib/highlightGeometry'
import { useObservable } from '@/composables/useObservable'
import { useStudySession } from '@/composables/useStudySession'
import VerseBlock from './VerseBlock.vue'
import TranslationSelector from './TranslationSelector.vue'
import ChapterNav from './ChapterNav.vue'
import AnnotationCanvas from '@/components/annotation/AnnotationCanvas.vue'
import AnnotationToolbar from '@/components/annotation/AnnotationToolbar.vue'
import NoteModal from '@/components/annotation/NoteModal.vue'
import StudyNotesPanel from '@/components/notes/StudyNotesPanel.vue'
import SaveNoteDialog from '@/components/notes/SaveNoteDialog.vue'
import NotesContextBar from '@/components/notes/NotesContextBar.vue'
import NotePopup from '@/components/notes/NotePopup.vue'
import NoteEditorModal from '@/components/notes/NoteEditorModal.vue'
import { Sheet } from '@/components/ui/sheet'
import { Columns2, Undo2, Redo2, Printer, BookmarkPlus } from 'lucide-vue-next'
import { useSavedNotesStore } from '@/stores/savedNotes'
import { useNoteStore } from '@/stores/noteStore'

const props = defineProps({
  book: { type: String, required: true },
  chapter: { type: Number, required: true }
})

const route = useRoute()
const auth = useAuthStore()
const settings = useSettingsStore()
const tool = useToolStore()
const undoRedo = useUndoRedoStore()
const savedNotesStore = useSavedNotesStore()
const noteStore = useNoteStore()
const { exportToPdf } = usePdfExport()

// ── User note state ────────────────────────────────────────────────────────────
const notePopupOpen = ref(false)
const notePopupNotes = ref([])          // notes to show in the popup
const noteEditorOpen = ref(false)
const noteEditorVerse = ref(null)
const noteEditorCharStart = ref(null)
const noteEditorCharEnd = ref(null)
const noteEditorQuote = ref(null)       // Selected words a phrase note is about
const noteEditTarget = ref(null)        // Note being edited (null = create)

// ── Notes context ─────────────────────────────────────────────────────────────
// Present when the reader was launched from the Notes tab. The NotesContextBar
// uses this to render note name + prev/next passage navigation.
const noteId = computed(() =>
  route.query.noteId ? Number(route.query.noteId) : null
)

// ── Save Note dialog ─────────────────────────────────────────────────────────
const saveNoteDialogOpen = ref(false)

/**
 * Handles the SaveNoteDialog 'save' event.
 * @param {{ type: 'new', name: string } | { type: 'existing', noteLocalId: number }} payload
 */
async function handleSaveNote({ type, name, noteLocalId }) {
  const passagePayload = {
    book: props.book,
    chapter: props.chapter,
    passageRef: passageReference.value,
    annotationCount: annotations.value?.length ?? 0
  }
  if (type === 'new') {
    await savedNotesStore.save({ name, ...passagePayload })
  } else {
    await savedNotesStore.addPassage(noteLocalId, passagePayload)
  }
}

// containerRef is the scrollable text div — canvas is sized to match it
const containerRef = ref(null)
// The inner wrapper holding the verses. Watched separately from containerRef
// because reflow (font size, column count, longer chapter) changes its height
// without changing the scroll container's border box.
const contentRef = ref(null)
const canvasSize = ref({ width: 0, height: 0 })
const scrollTopRef = ref(0)
// Where each highlight/underline is drawn *right now*, re-derived from its
// verse + char anchor. See lib/highlightGeometry.js.
const highlightBoxes = ref([])
const passage = ref(null)
const studyNotes = ref(null)
const loading = ref(true)
const error = ref(null)
const translation = ref(settings.defaultTranslation)

// ── Translation Comparison (PRD §5.1.2) ────────────────────────────────────
const showComparison = ref(false)
const secondaryTranslation = ref(null)
const secondaryPassage = ref(null)
// FIX: primaryScrollRef removed — the primary scroll element is always
// containerRef; using a separate ref caused a dual-ref conflict in the
// template where only the dynamic :ref took effect.
const secondaryScrollRef = ref(null)
let syncingScroll = false

// Populate secondary translation list — exclude the current primary translation
const AVAILABLE_TRANSLATIONS = ['BSB', 'KJV', 'ASV', 'WEB', 'YLT']

const secondaryTranslations = computed(() =>
  AVAILABLE_TRANSLATIONS.filter((t) => t !== translation.value)
)

watch(showComparison, async (on) => {
  if (!on) return
  if (!secondaryTranslation.value) {
    secondaryTranslation.value = secondaryTranslations.value[0]
  }
  await loadSecondary()
})

watch(secondaryTranslation, async (val) => {
  if (val && showComparison.value) await loadSecondary()
})

async function loadSecondary() {
  secondaryPassage.value = null
  try {
    secondaryPassage.value = await PassageRepository.get(props.book, props.chapter, secondaryTranslation.value)
  } catch {
    secondaryPassage.value = null
  }
}

// Verse-level sync scroll (PRD §5.1.2)
function onPrimaryScroll() {
  // FIX: use containerRef (always the primary scrollable div) instead of
  // the removed primaryScrollRef.
  if (syncingScroll || !secondaryScrollRef.value || !containerRef.value) return
  const ratio = containerRef.value.scrollTop / (containerRef.value.scrollHeight - containerRef.value.clientHeight || 1)
  syncingScroll = true
  secondaryScrollRef.value.scrollTop = ratio * (secondaryScrollRef.value.scrollHeight - secondaryScrollRef.value.clientHeight)
  syncingScroll = false
  onScroll()
}

function onSecondaryScroll() {
  if (syncingScroll || !primaryScrollRef.value || !secondaryScrollRef.value) return
  const ratio = secondaryScrollRef.value.scrollTop / (secondaryScrollRef.value.scrollHeight - secondaryScrollRef.value.clientHeight || 1)
  syncingScroll = true
  primaryScrollRef.value.scrollTop = ratio * (primaryScrollRef.value.scrollHeight - primaryScrollRef.value.clientHeight)
  syncingScroll = false
}

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
const { resolveSelection, resolvePhraseSelection } = useTextSelection(containerRef)

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
  undoRedo.clear()
  try {
    passage.value = await PassageRepository.get(props.book, props.chapter, translation.value)
  } catch (e) {
    error.value = 'Could not load this passage. Please check your connection.'
  } finally {
    loading.value = false
  }
  try {
    studyNotes.value = await PassageRepository.getNotes(props.book, props.chapter, translation.value)
  } catch {
    studyNotes.value = null
  }
  if (showComparison.value) await loadSecondary()
}

watch([() => props.book, () => props.chapter, translation], load, { immediate: true })

// Reload passage notes whenever book/chapter changes
watch(
  [() => props.book, () => props.chapter],
  ([book, chapter]) => noteStore.loadForPassage(book, chapter),
  { immediate: true }
)

// ─── Canvas sizing ────────────────────────────────────────────────────────────
function measureCanvas() {
  if (!containerRef.value) return
  canvasSize.value = {
    width: containerRef.value.offsetWidth,
    height: containerRef.value.scrollHeight
  }
}

const resizeObserver = new ResizeObserver(measureCanvas)

watch(containerRef, (el, prevEl) => {
  if (prevEl) resizeObserver.unobserve(prevEl)
  if (el) {
    resizeObserver.observe(el)
    measureCanvas()
  }
})
onUnmounted(() => resizeObserver.disconnect())

// ─── Highlight geometry ───────────────────────────────────────────────────────
// A highlight is stored against the words it covers (verse + char range), the
// same way a note is — so unlike the pixel rect it was drawn at, it survives a
// reflow. The cost is that its rectangles have to be measured again from the
// live DOM whenever that layout changes, which is what this does.
function refreshHighlightGeometry() {
  highlightBoxes.value = buildHighlightBoxes(containerRef.value, annotations.value)
}

/** Measure after Vue has flushed, so the DOM reflects the change that woke us. */
async function refreshLayout() {
  await nextTick()
  measureCanvas()
  refreshHighlightGeometry()
}

// Content reflow: font size, line height, column count, a longer chapter.
// Kept on its own observer so the container observer's contract (one observed
// element, disconnected on unmount) stays intact.
const contentObserver = new ResizeObserver(refreshLayout)

watch(contentRef, (el, prevEl) => {
  if (prevEl) contentObserver.unobserve(prevEl)
  if (el) {
    contentObserver.observe(el)
    refreshLayout()
  }
})
onUnmounted(() => contentObserver.disconnect())

// Annotations changing (a new highlight, an erase, a sync landing) needs the
// boxes rebuilt even though nothing about the layout moved.
watch(annotations, refreshLayout)

// Reflows the ResizeObserver can miss or that need geometry re-measured even
// when the box sizes happen to land the same: new passage text, and the
// typography settings that re-wrap it.
watch(
  [passage, () => settings.fontSize, () => settings.lineHeight,
    () => settings.twoColumnPreferred, showComparison],
  refreshLayout
)

// Web fonts swap in after first paint; the metrics they bring shift every line.
onMounted(() => {
  document.fonts?.ready?.then(refreshLayout).catch(() => {})
})

// ─── Keyboard shortcuts (undo / redo) ────────────────────────────────────────
function onKeydown(evt) {
  const ctrl = evt.ctrlKey || evt.metaKey
  if (!ctrl) return
  if (evt.key === 'z' && !evt.shiftKey) {
    evt.preventDefault()
    undoRedo.undo()
  } else if (evt.key === 'z' && evt.shiftKey) {
    evt.preventDefault()
    undoRedo.redo()
  } else if (evt.key === 'y') {
    evt.preventDefault()
    undoRedo.redo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ─── Highlight / Underline ────────────────────────────────────────────────────
function onPointerUp(evt) {
  if (tool.activeTool === TOOLS.PEN) return

  // Note tool: selecting a word or phrase opens the note dialog anchored to
  // exactly those characters, mirroring the verse-number tap (PRD §5.3).
  if (tool.activeTool === TOOLS.NOTE) {
    const phrase = resolvePhraseSelection()
    if (!phrase) return
    openNoteEditor({
      verse: phrase.verse,
      charStart: phrase.charStart,
      charEnd: phrase.charEnd,
      quote: phrase.text
    })
    return
  }

  const selections = resolveSelection()
  if (!selections) return
  saveHighlight(selections)
}

/**
 * Persists a highlight or underline as ONE record per verse, anchored to the
 * characters it covers — the same anchor a note uses.
 *
 * It used to write one record per line box, freezing the pixel rectangle the
 * words happened to occupy on the screen it was drawn on. That is why a
 * highlight drifted off its text on a different screen size while a note never
 * did. The line boxes are now re-measured at render time from the char range
 * (lib/highlightGeometry.js), so how the text wraps is no longer baked in.
 */
async function saveHighlight(selections) {
  const scrollTop = containerRef.value?.scrollTop ?? 0
  const scrollLeft = containerRef.value?.scrollLeft ?? 0

  for (const sel of selections) {
    const first = sel.rects[0]
    const localId = await AnnotationRepository.create({
      userId: auth.user?.id ?? 'local',
      book: sel.book,
      chapter: sel.chapter,
      verse: sel.verse,
      type: tool.activeTool === TOOLS.UNDERLINE ? 'underline' : 'highlight',
      colour: tool.activeColour,
      data: {
        charStart: sel.charStart,
        charEnd: sel.charEnd,
        // Kept only so a client running an older build (or one that cannot
        // resolve the anchor) still draws something. Never read when the char
        // range resolves against the rendered verse.
        rect: first
          ? {
            x: first.x + scrollLeft,
            y: first.y + scrollTop,
            width: first.width,
            height: first.height
          }
          : null,
        opacity: tool.activeTool === TOOLS.HIGHLIGHTER ? 0.35 : 1
      }
    })
    undoRedo.recordCreate(localId)
  }
}

// ─── Pen stroke ───────────────────────────────────────────────────────────────
async function onPenStrokeEnd(stroke) {
  const localId = await AnnotationRepository.create({
    userId: auth.user?.id ?? 'local',
    book: props.book,
    chapter: props.chapter,
    verse: null,
    type: 'pen',
    colour: stroke.colour,
    data: stroke
  })
  undoRedo.recordCreate(localId)
}

// ─── Shape stroke ─────────────────────────────────────────────────────────────
async function onShapeStrokeEnd(shape) {
  const localId = await AnnotationRepository.create({
    userId: auth.user?.id ?? 'local',
    book: props.book,
    chapter: props.chapter,
    verse: null,
    type: 'shape',
    colour: shape.colour,
    data: shape
  })
  undoRedo.recordCreate(localId)
}

// ─── Eraser ───────────────────────────────────────────────────────────────────
/**
 * @param {number|Array<number>} target  a single annotation, or every record
 *   behind one visible mark — older highlights were stored one row per line
 *   box, and erasing a mark has to take all of them.
 */
async function onErase(target) {
  for (const localId of Array.isArray(target) ? target : [target]) {
    undoRedo.recordRemove(localId)
    await AnnotationRepository.remove(localId)
  }
}

// ─── Note popup helpers ───────────────────────────────────────────────────────

/**
 * The words a phrase-anchored note points at, resolved from its char range
 * against the loaded passage text (nothing is stored server-side).
 */
function quoteForNote(note) {
  if (note?.char_start == null || note?.char_end == null) return null
  const verse = verses.value.find((v) => v.number === note.verse)
  if (!verse) return null
  return extractPhrase(verse.text, note.char_start, note.char_end)
}

function showNotesInPopup(notes) {
  notePopupNotes.value = notes.map((note) => ({ ...note, quote: quoteForNote(note) }))
  if (notePopupNotes.value.length) notePopupOpen.value = true
}

function openNotePopup(verseNumber) {
  showNotesInPopup(noteStore.verseNotesByVerse[verseNumber] ?? [])
}

/** Tapping the dotted underline opens just that phrase's note. */
function onPhraseNoteTap(noteLocalId) {
  const note = noteStore.passageNotes.find((n) => n.localId === noteLocalId)
  if (note) showNotesInPopup([note])
}

function openNoteEditor({ verse = null, charStart = null, charEnd = null, quote = null, editNote = null } = {}) {
  noteEditorVerse.value = verse
  noteEditorCharStart.value = charStart
  noteEditorCharEnd.value = charEnd
  noteEditorQuote.value = quote ?? quoteForNote(editNote)
  noteEditTarget.value = editNote
  noteEditorOpen.value = true
}

// ─── Verse tap ────────────────────────────────────────────────────────────────
function onVerseTap(verseNumber) {
  if ([TOOLS.PEN, TOOLS.HIGHLIGHTER, TOOLS.UNDERLINE, TOOLS.SHAPE, TOOLS.ERASER].includes(tool.activeTool)) return

  if (tool.activeTool === TOOLS.NOTE) {
    openNoteEditor({ verse: verseNumber })
    return
  }

  const hasUserNote = !!(noteStore.verseNotesByVerse[verseNumber]?.length)
  const hasCommentary = !!(studyNotes.value?.verses?.[verseNumber])

  if (hasCommentary && hasUserNote) {
    // Both exist — show action sheet options in study notes panel with an added user-note option
    notesTargetVerse.value = verseNumber
    notesSheetOpen.value = true
    return
  }
  if (hasCommentary) {
    notesTargetVerse.value = verseNumber
    notesSheetOpen.value = true
    return
  }
  // Commentary-only or note-only: note dot handles its own tap; verse number tap does nothing extra
}

function onNoteDotTap(verseNumber) {
  openNotePopup(verseNumber)
}

const passageReference = computed(() => passage.value?.reference ?? `${props.book} ${props.chapter}`)

useStudySession(() => passageReference.value)

const verses = computed(() => passage.value?.verses ?? [])
const secondaryVerses = computed(() => secondaryPassage.value?.verses ?? [])

// ─── PDF Export (PRD §5.5) ────────────────────────────────────────────────────
async function handleExportPdf() {
  // Grab a data-URL snapshot of the annotation canvas if present
  const canvasEl = document.querySelector('canvas')
  const canvasDataUrl = canvasEl ? canvasEl.toDataURL() : null

  await exportToPdf({
    passageRef: passageReference.value,
    translation: translation.value,
    verses: verses.value,
    canvasDataUrl,
    theme: settings.theme ?? 'light'
  })
}
</script>

<template>
  <div class="relative flex h-full flex-col overflow-hidden">
    <!-- Notes context bar — visible when reader is opened from the Notes tab -->
    <NotesContextBar
      v-if="noteId"
      :note-id="noteId"
      :book="book"
      :chapter="chapter"
    />

    <!-- Chapter nav header -->
    <ChapterNav
      :book="book"
      :chapter="chapter"
      :reference="passageReference"
      :chapter-count="passage?.totalChapters ?? 150"
    />

    <!-- Translation selector row + comparison toggle -->
    <div class="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
      <TranslationSelector v-model="translation" />

      <!-- Compare button (PRD §5.1.2) -->
      <button
        type="button"
        class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
        :class="showComparison
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-muted-foreground hover:text-foreground'"
        :aria-label="showComparison ? 'Close comparison' : 'Compare translations'"
        @click="showComparison = !showComparison"
      >
        <Columns2 class="h-3.5 w-3.5" />
        <span class="hidden sm:inline">Compare</span>
      </button>

      <!-- Secondary translation selector (visible when comparison is open) -->
      <select
        v-if="showComparison"
        v-model="secondaryTranslation"
        class="ml-1 rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground focus:outline-none"
        aria-label="Secondary translation"
      >
        <option v-for="t in secondaryTranslations" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- PDF Export button (PRD §5.5) -->
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-secondary text-foreground"
        aria-label="Export to PDF"
        @click="handleExportPdf"
      >
        <Printer class="h-4 w-4" />
      </button>

      <!-- Save Note button — creates an explicitly named note in the Notes tab -->
      <button
        type="button"
        class="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-secondary text-foreground"
        aria-label="Save note"
        @click="saveNoteDialogOpen = true"
      >
        <BookmarkPlus class="h-4 w-4" />
      </button>

      <!-- Undo / Redo buttons -->
      <div class="ml-auto flex items-center gap-1">
        <button
          type="button"
          :disabled="!undoRedo.canUndo"
          class="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30"
          :class="undoRedo.canUndo ? 'hover:bg-secondary text-foreground' : 'text-muted-foreground'"
          aria-label="Undo"
          @click="undoRedo.undo()"
        >
          <Undo2 class="h-4 w-4" />
        </button>
        <button
          type="button"
          :disabled="!undoRedo.canRedo"
          class="flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-30"
          :class="undoRedo.canRedo ? 'hover:bg-secondary text-foreground' : 'text-muted-foreground'"
          aria-label="Redo"
          @click="undoRedo.redo()"
        >
          <Redo2 class="h-4 w-4" />
        </button>
        <span class="text-xs text-muted-foreground">
          {{ verses.length }} verse{{ verses.length === 1 ? '' : 's' }}
        </span>
      </div>
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
      Scripture text + canvas overlay — supports single column or side-by-side comparison.
    -->
    <div
      v-else
      class="relative flex flex-1 overflow-hidden"
      :class="showComparison ? 'divide-x divide-border' : ''"
      @pointerup="onPointerUp"
    >
      <!-- PRIMARY column (always shown) -->
      <div
        class="relative"
        :class="showComparison ? 'w-1/2' : 'flex-1'"
      >
        <div
          ref="containerRef"
          class="h-full overflow-y-auto"
          @scroll="showComparison ? onPrimaryScroll() : onScroll()"
          :class="[
            tool.activeTool === TOOLS.PEN ||
            tool.activeTool === TOOLS.ERASER ||
            tool.activeTool === TOOLS.SHAPE
              ? 'select-none'
              : ''
          ]"
        >
          <div
            ref="contentRef"
            class="relative z-0 px-4 py-5"
            :class="!showComparison && settings.twoColumnPreferred ? 'md:columns-2 md:gap-8' : ''"
          >
            <h1 class="font-scripture text-xl font-semibold text-foreground mb-6 break-after-avoid">
              {{ passageReference }}
              <span v-if="showComparison" class="ml-2 text-xs font-mono text-muted-foreground">({{ translation }})</span>
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
                :has-note="!!(noteStore.verseNotesByVerse[verse.number]?.length)"
                :phrase-notes="noteStore.phraseNotesByVerse[verse.number] ?? []"
                @verse-tap="onVerseTap"
                @note-dot-tap="onNoteDotTap"
                @phrase-note-tap="onPhraseNoteTap"
              />
            </p>
          </div>
        </div>

        <!-- Canvas overlay — only on the primary column -->
        <AnnotationCanvas
          :annotations="annotations"
          :highlight-boxes="highlightBoxes"
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

      <!-- SECONDARY column — translation comparison (PRD §5.1.2) -->
      <div
        v-if="showComparison"
        class="relative w-1/2 overflow-hidden"
      >
        <div
          ref="secondaryScrollRef"
          class="h-full overflow-y-auto"
          @scroll="onSecondaryScroll"
        >
          <div class="relative z-0 px-4 py-5">
            <h1 class="font-scripture text-xl font-semibold text-foreground mb-6">
              {{ passageReference }}
              <span class="ml-2 text-xs font-mono text-muted-foreground">({{ secondaryTranslation }})</span>
            </h1>

            <div v-if="!secondaryPassage" class="flex items-center justify-center py-12">
              <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>

            <p v-else class="font-scripture">
              <VerseBlock
                v-for="verse in secondaryVerses"
                :key="verse.number"
                :book="book"
                :chapter="chapter"
                :verse="verse"
                :font-size="settings.fontSize"
                :line-height="settings.lineHeight"
              />
            </p>
          </div>
        </div>
      </div>
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

    <!-- Save Note dialog — names and persists the current study session as a Note -->
    <SaveNoteDialog
      v-model="saveNoteDialogOpen"
      :passage-ref="passageReference"
      @save="handleSaveNote"
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

    <!-- User note popup — shows existing note(s) for a verse -->
    <NotePopup
      v-model="notePopupOpen"
      :notes="notePopupNotes"
      @edit="(note) => openNoteEditor({ editNote: note })"
    />

    <!-- Note editor modal — create or edit a user note -->
    <NoteEditorModal
      v-model="noteEditorOpen"
      :book="book"
      :chapter="chapter"
      :verse="noteEditorVerse"
      :char-start="noteEditorCharStart"
      :char-end="noteEditorCharEnd"
      :quote="noteEditorQuote"
      :edit-note="noteEditTarget"
      @saved="noteStore.loadForPassage(book, chapter)"
    />
  </div>
</template>
