<script setup>
import { ref, computed, watch } from 'vue'
import { Search, Highlighter, PenLine, Type, Underline } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'vue-router'
import AnnotationRepository from '@/lib/annotationRepository'

const router = useRouter()
const query = ref('')
const results = ref([])
const loading = ref(false)

const TYPE_ICONS = {
  highlight: Highlighter,
  pen: PenLine,
  underline: Underline,
  note: Type
}

const TYPE_LABELS = {
  highlight: 'Highlight',
  pen: 'Drawing',
  underline: 'Underline',
  note: 'Note',
  shape: 'Shape'
}

async function search() {
  loading.value = true
  results.value = await AnnotationRepository.search({
    keyword: query.value,
  })
  loading.value = false
}

// Debounce the live search
let debounce
watch(query, () => {
  clearTimeout(debounce)
  debounce = setTimeout(search, 300)
})
search() // initial load

function openAnnotation(a) {
  router.push({ name: 'reader', params: { book: a.book, chapter: a.chapter } })
}

const grouped = computed(() => {
  const map = {}
  for (const a of results.value) {
    const key = `${a.book} ${a.chapter}`
    if (!map[key]) map[key] = { ref: key, annotations: [] }
    map[key].annotations.push(a)
  }
  return Object.values(map)
})
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <div class="border-b border-border px-4 pt-5 pb-3">
      <h1 class="text-lg font-semibold mb-3">My Annotations</h1>
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="query" placeholder="Search by keyword, verse, colour…" class="pl-9" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>

      <div v-else-if="results.length === 0" class="flex flex-col items-center py-16 text-muted-foreground">
        <Highlighter class="h-10 w-10 opacity-30 mb-3" />
        <p class="text-sm">No annotations yet</p>
        <p class="text-xs mt-1">Open a passage and start marking</p>
      </div>

      <div v-else>
        <div v-for="group in grouped" :key="group.ref">
          <p class="sticky top-0 z-10 bg-secondary/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
            {{ group.ref }}
          </p>
          <button
            v-for="a in group.annotations"
            :key="a.localId"
            type="button"
            class="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3.5 text-left active:bg-secondary"
            @click="openAnnotation(a)"
          >
            <span
              class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              :style="{ background: a.colour + '22', color: a.colour }"
            >
              <component :is="TYPE_ICONS[a.type] ?? PenLine" class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-mono text-muted-foreground">v.{{ a.verse ?? '—' }}</span>
                <Badge variant="secondary" class="text-[10px] py-0">{{ TYPE_LABELS[a.type] ?? a.type }}</Badge>
                <span v-if="a.dirty" class="ml-auto text-[10px] text-muted-foreground">pending sync</span>
              </div>
              <p v-if="a.data?.text" class="mt-0.5 text-sm text-foreground line-clamp-2">
                {{ a.data.text }}
              </p>
              <p v-else class="mt-0.5 text-xs text-muted-foreground">
                {{ TYPE_LABELS[a.type] }}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
