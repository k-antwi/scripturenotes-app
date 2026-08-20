<script setup>
/**
 * NotesContextBar — shown inside the reader when it was opened from the Notes tab.
 *
 * Renders: note name (tappable → back to /notes), passage position counter,
 * and ← / → buttons to step through every passage saved in the note.
 *
 * It stays alive across chapter navigations because the noteId query param
 * persists in every router.push() this component makes.
 */
import { computed } from 'vue'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, NotebookPen } from 'lucide-vue-next'

const props = defineProps({
  noteId:  { type: Number, required: true },
  book:    { type: String, required: true },
  chapter: { type: Number, required: true }
})

const router = useRouter()

// Live note record — re-queries when noteId changes
const note = useObservable(
  () => liveQuery(() => db.savedNotes.get(props.noteId)),
  null,
  [() => props.noteId]
)

// All passages for this note, sorted oldest-first (matches order user built them)
const passages = useObservable(
  () => liveQuery(() =>
    db.savedNotePassages
      .where('savedNoteLocalId')
      .equals(props.noteId)
      .toArray()
      .then((arr) => arr.sort((a, b) => (a.savedAt < b.savedAt ? -1 : 1)))
  ),
  [],
  [() => props.noteId]
)

const currentIndex = computed(() =>
  passages.value.findIndex(
    (p) => p.book === props.book && p.chapter === props.chapter
  )
)

const prevPassage = computed(() => passages.value[currentIndex.value - 1] ?? null)
const nextPassage = computed(() => passages.value[currentIndex.value + 1] ?? null)

// Human-readable position: "2 of 5" — shows "– of N" while index resolves
const positionLabel = computed(() => {
  const total = passages.value.length
  const pos = currentIndex.value >= 0 ? currentIndex.value + 1 : '–'
  return `${pos} of ${total}`
})

function navigateTo(passage) {
  router.push({
    name: 'reader',
    params: { book: passage.book, chapter: passage.chapter },
    query: { noteId: props.noteId }
  })
}

function backToNotes() {
  router.push({ name: 'notes' })
}
</script>

<template>
  <div
    class="flex items-center gap-2 border-b border-primary/20 bg-primary/8 px-3 py-1.5 text-primary text-xs"
    role="navigation"
    aria-label="Notes context navigation"
  >
    <!-- Note name — tapping returns to the Notes list -->
    <button
      type="button"
      class="flex shrink-0 items-center gap-1.5 font-medium hover:underline focus-visible:outline-none"
      aria-label="Back to notes list"
      @click="backToNotes"
    >
      <NotebookPen class="h-3.5 w-3.5 shrink-0" />
      <span class="max-w-[140px] truncate">{{ note?.name ?? 'Note' }}</span>
    </button>

    <!-- Spacer + position counter -->
    <span class="flex-1 text-center text-[10px] text-primary/50 tabular-nums select-none">
      {{ positionLabel }}
    </span>

    <!-- Prev / Next passage arrows -->
    <div class="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        :disabled="!prevPassage"
        class="flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:outline-none disabled:opacity-30"
        :class="prevPassage ? 'hover:bg-primary/15 active:bg-primary/25' : ''"
        :aria-label="prevPassage ? `Previous passage: ${prevPassage.passageRef}` : 'No previous passage'"
        @click="prevPassage && navigateTo(prevPassage)"
      >
        <ChevronLeft class="h-4 w-4" />
      </button>

      <button
        type="button"
        :disabled="!nextPassage"
        class="flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:outline-none disabled:opacity-30"
        :class="nextPassage ? 'hover:bg-primary/15 active:bg-primary/25' : ''"
        :aria-label="nextPassage ? `Next passage: ${nextPassage.passageRef}` : 'No next passage'"
        @click="nextPassage && navigateTo(nextPassage)"
      >
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
