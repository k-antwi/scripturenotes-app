<script setup>
import { ref, computed, watch } from 'vue'
import { Search, Highlighter, PenLine, Type, Underline, Circle, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'vue-router'
import AnnotationRepository from '@/lib/annotationRepository'
import { PRESET_COLOURS } from '@/stores/tool'

const router = useRouter()
const query = ref('')
const activeType = ref(null)   // null = all types
const activeColour = ref(null) // null = all colours
const results = ref([])
const loading = ref(false)

const TYPE_OPTIONS = [
  { id: 'highlight', label: 'Highlight', icon: Highlighter },
  { id: 'pen',       label: 'Drawing',  icon: PenLine },
  { id: 'underline', label: 'Underline',icon: Underline },
  { id: 'note',      label: 'Note',     icon: Type },
  { id: 'shape',     label: 'Shape',    icon: Circle }
]

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
    keyword: query.value || undefined,
    type: activeType.value || undefined,
    colour: activeColour.value || undefined
  })
  loading.value = false
}

// Debounce the live keyword search; filters re-run immediately
let debounce
watch(query, () => {
  clearTimeout(debounce)
  debounce = setTimeout(search, 300)
})

watch([activeType, activeColour], search)

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

const hasFilters = computed(() => activeType.value || activeColour.value)

function clearFilters() {
  activeType.value = null
  activeColour.value = null
}
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <div class="border-b border-border px-4 pt-5 pb-3 space-y-3">
      <h1 class="text-lg font-semibold">My Annotations</h1>

      <!-- Keyword search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="query" placeholder="Search by keyword…" class="pl-9" />
      </div>

      <!-- Type filter chips (PRD §5.5) -->
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="t in TYPE_OPTIONS"
          :key="t.id"
          type="button"
          class="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
          :class="activeType === t.id
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card text-muted-foreground hover:text-foreground'"
          @click="activeType = activeType === t.id ? null : t.id"
        >
          <component :is="t.icon" class="h-3 w-3" />
          {{ t.label }}
        </button>
      </div>

      <!-- Colour filter swatches (PRD §5.5) -->
      <div class="flex gap-2 flex-wrap items-center">
        <span class="text-xs text-muted-foreground">Colour:</span>
        <button
          v-for="c in PRESET_COLOURS"
          :key="c.hex"
          type="button"
          class="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
          :style="{ background: c.hex }"
          :class="activeColour === c.hex ? 'border-foreground scale-110' : 'border-transparent'"
          :aria-label="c.name"
          @click="activeColour = activeColour === c.hex ? null : c.hex"
        />
        <button
          v-if="hasFilters"
          type="button"
          class="flex items-center gap-0.5 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground ml-auto"
          @click="clearFilters"
        >
          <X class="h-3 w-3" /> Clear
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>

      <div v-else-if="results.length === 0" class="flex flex-col items-center py-16 text-muted-foreground">
        <Highlighter class="h-10 w-10 opacity-30 mb-3" />
        <p class="text-sm">No annotations found</p>
        <p v-if="hasFilters" class="text-xs mt-1">Try clearing your filters</p>
        <p v-else class="text-xs mt-1">Open a passage and start marking</p>
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
              <component :is="TYPE_OPTIONS.find(t => t.id === a.type)?.icon ?? PenLine" class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-mono text-muted-foreground">v.{{ a.verse ?? '—' }}</span>
                <Badge variant="secondary" class="text-[10px] py-0">{{ TYPE_LABELS[a.type] ?? a.type }}</Badge>
                <!-- Colour dot -->
                <span
                  class="h-2.5 w-2.5 rounded-full border border-black/10"
                  :style="{ background: a.colour }"
                />
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
