<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'
import { Highlighter, PenLine, Type, Underline, ChevronLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const route = useRoute()
const router = useRouter()
const notebookLocalId = Number(route.params.id)

const notebook = useObservable(
  () => liveQuery(() => db.notebooks.get(notebookLocalId)),
  null
)

const pivotRows = useObservable(
  () => liveQuery(() => db.annotationNotebook.where({ notebookLocalId }).toArray()),
  []
)

const annotationIds = computed(() => pivotRows.value.map(p => p.annotationLocalId))

const annotations = useObservable(
  () => liveQuery(async () => {
    if (!annotationIds.value.length) return []
    return db.annotations.where('localId').anyOf(annotationIds.value).filter(a => !a.deletedAt).toArray()
  }),
  [],
  [annotationIds]
)

const TYPE_ICONS = { highlight: Highlighter, pen: PenLine, underline: Underline, note: Type }
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <div class="flex items-center gap-2 border-b border-border px-3 pt-5 pb-3">
      <Button size="icon" variant="ghost" @click="router.back()">
        <ChevronLeft class="h-5 w-5" />
      </Button>
      <h1 class="flex-1 text-base font-semibold">{{ notebook?.title ?? '…' }}</h1>
      <Badge variant="secondary">{{ annotations.length }}</Badge>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="annotations.length === 0" class="flex flex-col items-center py-16 text-muted-foreground">
        <p class="text-sm">No annotations in this notebook yet.</p>
      </div>

      <button
        v-for="a in annotations"
        :key="a.localId"
        type="button"
        class="flex w-full items-start gap-3 border-b border-border/60 px-4 py-3.5 text-left active:bg-secondary"
        @click="router.push({ name: 'reader', params: { book: a.book, chapter: a.chapter } })"
      >
        <span
          class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          :style="{ background: a.colour + '22', color: a.colour }"
        >
          <component :is="TYPE_ICONS[a.type] ?? PenLine" class="h-4 w-4" />
        </span>
        <div>
          <p class="text-xs font-mono text-muted-foreground">{{ a.book }} {{ a.chapter }}:{{ a.verse ?? '—' }}</p>
          <p v-if="a.data?.text" class="mt-0.5 text-sm line-clamp-2">{{ a.data.text }}</p>
          <p v-else class="mt-0.5 text-xs text-muted-foreground capitalize">{{ a.type }}</p>
        </div>
      </button>
    </div>
  </div>
</template>
