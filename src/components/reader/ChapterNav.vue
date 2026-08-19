<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const props = defineProps({
  book: { type: String, required: true },
  chapter: { type: Number, required: true },
  chapterCount: { type: Number, default: 31 },
  reference: { type: String, default: '' }
})

const router = useRouter()

const hasPrev = computed(() => props.chapter > 1)
const hasNext = computed(() => props.chapter < props.chapterCount)

function go(delta) {
  const next = props.chapter + delta
  if (next < 1 || next > props.chapterCount) return
  router.push({ name: 'reader', params: { book: props.book, chapter: next } })
}
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 border-b border-border bg-card safe-top">
    <router-link
      :to="{ name: 'book-picker' }"
      class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <BookOpen class="h-4 w-4" />
      <span class="font-medium">{{ reference || `${book} ${chapter}` }}</span>
    </router-link>

    <div class="ml-auto flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        :disabled="!hasPrev"
        class="h-9 w-9"
        @click="go(-1)"
      >
        <ChevronLeft class="h-5 w-5" />
      </Button>
      <span class="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums">{{ chapter }}</span>
      <Button
        size="icon"
        variant="ghost"
        :disabled="!hasNext"
        class="h-9 w-9"
        @click="go(1)"
      >
        <ChevronRight class="h-5 w-5" />
      </Button>
    </div>
  </div>
</template>
