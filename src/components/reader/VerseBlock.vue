<script setup>
import { ref } from 'vue'

const props = defineProps({
  book: { type: String, required: true },
  chapter: { type: Number, required: true },
  verse: { type: Object, required: true }, // { number, text, footnotes? }
  fontSize: { type: Number, default: 17 },
  lineHeight: { type: Number, default: 1.6 }
})

const emit = defineEmits(['verse-tap'])
const noteExpanded = ref(false)

function handleVerseTap() {
  emit('verse-tap', props.verse.number)
}

// Footnote markers like ᵃ, ¹ are extracted inline (PRD §5.1.1)
function parseText(raw) {
  // Match [a] or [1] style markers in source text and replace with styled spans
  return raw.replace(/\[([a-z0-9])\]/g, (_, m) =>
    `<sup class="footnote-marker cursor-pointer text-accent opacity-80" data-marker="${m}">${m}</sup>`
  )
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
    <!-- Verse number: always superscript, coloured, tap → study notes (PRD §5.1.1, §5.3) -->
    <sup
      class="verse-num mr-0.5 cursor-pointer font-sans text-accent select-none"
      :style="{ fontSize: `${Math.round(fontSize * 0.7)}px` }"
      @click="handleVerseTap"
    >{{ verse.number }}</sup>

    <!-- Verse text — html for inline footnote markers -->
    <span
      class="scripture-text"
      v-html="parseText(verse.text)"
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
