<script setup>
import { ref, computed } from 'vue'
import { buildVerseHtml } from '@/lib/verseSegments'

const props = defineProps({
  book: { type: String, required: true },
  chapter: { type: Number, required: true },
  verse: { type: Object, required: true }, // { number, text, footnotes? }
  fontSize: { type: Number, default: 17 },
  lineHeight: { type: Number, default: 1.6 },
  hasNote: { type: Boolean, default: false },  // show margin dot if true
  // Notes anchored to a word/phrase inside this verse. Each is underlined
  // in place and tappable (PRD §5.3).
  phraseNotes: { type: Array, default: () => [] },
})

const emit = defineEmits(['verse-tap', 'note-dot-tap', 'phrase-note-tap'])
const noteExpanded = ref(false)

function handleVerseTap() {
  emit('verse-tap', props.verse.number)
}

function handleNoteDotTap(evt) {
  evt.stopPropagation()
  emit('note-dot-tap', props.verse.number)
}

// Footnote markers like [a], [1] become <sup>; phrase-note ranges become
// dotted-underlined, tappable spans (see lib/verseSegments.js).
const verseHtml = computed(() =>
  buildVerseHtml(
    props.verse.text,
    props.phraseNotes.map((note) => ({
      charStart: note.char_start,
      charEnd: note.char_end,
      noteLocalId: note.localId,
    }))
  )
)

/** Delegated tap handler — the underlined spans are rendered via v-html. */
function handleTextTap(evt) {
  const target = evt.target?.closest?.('[data-note-id]')
  if (!target) return
  evt.stopPropagation()
  const localId = Number(target.dataset.noteId)
  emit('phrase-note-tap', Number.isNaN(localId) ? target.dataset.noteId : localId)
}
</script>

<template>
  <!-- data-* attributes are read by useTextSelection to resolve char ranges -->
  <span
    :data-verse="verse.number"
    :data-book="book"
    :data-chapter="chapter"
    class="verse-block"
    :style="{ fontSize: `${fontSize}px`, lineHeight }"
  >
    <!-- Verse number wrapper: margin dot (note indicator) + verse number -->
    <span class="verse-number-wrapper relative inline-flex items-center">
      <!-- Margin dot — visible when this verse has whole-verse user notes -->
      <span
        v-if="hasNote"
        class="note-dot"
        :style="{ width: `${Math.round(fontSize * 0.4)}px`, height: `${Math.round(fontSize * 0.4)}px` }"
        aria-label="View note"
        @click="handleNoteDotTap"
      />
      <sup
        class="verse-num mr-0.5 cursor-pointer font-sans text-accent select-none"
        :style="{ fontSize: `${Math.round(fontSize * 0.7)}px` }"
        @click="handleVerseTap"
      >{{ verse.number }}</sup>
    </span><!-- end .verse-number-wrapper -->

    <!-- Verse text — html for inline footnote markers and phrase-note underlines -->
    <span
      class="scripture-text"
      v-html="verseHtml"
      @click="handleTextTap"
    />

    <!-- Space between verses -->
    {{ ' ' }}

    <!-- Inline footnotes (PRD §5.1.1 "expands footnote inline") -->
    <template v-if="verse.footnotes?.length">
      <button
        v-for="fn in verse.footnotes"
        :key="fn.marker"
        type="button"
        class="footnote-inline mt-1 block rounded bg-secondary px-2 py-1 text-left text-sm text-muted-foreground transition-all"
        :class="noteExpanded ? 'max-h-40' : 'max-h-0 overflow-hidden'"
        @click="noteExpanded = !noteExpanded"
      >
        <sup class="mr-0.5 text-accent">{{ fn.marker }}</sup>{{ fn.text }}
      </button>
    </template>
  </span>
</template>

<style scoped>
.verse-number-wrapper {
  display: inline-flex;
  align-items: center;
}

.note-dot {
  display: inline-block;
  border-radius: 50%;
  background-color: var(--color-accent, #6366f1);
  margin-right: 2px;
  cursor: pointer;
  flex-shrink: 0;
  min-width: 6px;
  min-height: 6px;
}

/*
  Phrase-anchored notes. Dotted rather than solid so the marker never reads
  as the Underline annotation tool, and text-decoration (not a border) so it
  wraps correctly across lines.
*/
.scripture-text :deep(.phrase-note) {
  cursor: pointer;
  text-decoration: underline dotted;
  text-decoration-color: var(--color-accent, #6366f1);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 3px;
}

.scripture-text :deep(.phrase-note:hover),
.scripture-text :deep(.phrase-note:focus-visible) {
  background-color: color-mix(in srgb, var(--color-accent, #6366f1) 12%, transparent);
  border-radius: 2px;
  outline: none;
}
</style>
