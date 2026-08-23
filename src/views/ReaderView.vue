<script setup>
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import ScriptureReader from '@/components/reader/ScriptureReader.vue'
import { useReadingStore, DEFAULT_PASSAGE } from '@/stores/reading'

const route = useRoute()
const reading = useReadingStore()

const book = computed(() => (route.params.book ?? DEFAULT_PASSAGE.book).toUpperCase())
const chapter = computed(() => Number(route.params.chapter ?? DEFAULT_PASSAGE.chapter))

// Remember where the user is reading so the Read tab and the root redirect
// return here instead of the hardcoded default.
watch(
  [book, chapter],
  ([currentBook, currentChapter]) => reading.setLastPassage(currentBook, currentChapter),
  { immediate: true }
)
</script>

<template>
  <ScriptureReader :book="book" :chapter="chapter" />
</template>
