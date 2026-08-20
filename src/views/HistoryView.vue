<script setup>
import { computed } from 'vue'
import { Clock, BookOpen, Highlighter } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'

const router = useRouter()

// Load sessions and all (non-deleted) annotations so we can count per passage
const sessions = useObservable(
  () => liveQuery(() => db.studySessions.orderBy('startedAt').reverse().limit(200).toArray()),
  []
)

const allAnnotations = useObservable(
  () => liveQuery(() => db.annotations.filter((a) => !a.deletedAt).toArray()),
  []
)

/**
 * Count annotations for a passageRef (e.g. "PRO 19").
 * passageRef is stored as "<BOOK> <CHAPTER>" in studySessions.
 */
function annotationCountFor(passageRef) {
  if (!passageRef || !allAnnotations.value?.length) return 0
  const parts = passageRef.trim().split(/\s+/)
  if (parts.length < 2) return 0
  const [book, chapter] = [parts[0], Number(parts[1])]
  return allAnnotations.value.filter(
    (a) => a.book === book && a.chapter === chapter
  ).length
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short'
  })
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function navigate(s) {
  if (s.passageRef) {
    const parts = s.passageRef.trim().split(/\s+/)
    router.push(`/read/${parts[0]}/${parts[1] ?? 1}`)
  } else {
    router.push('/')
  }
}
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <div class="border-b border-border px-4 pt-5 pb-3">
      <h1 class="text-lg font-semibold">Reading history</h1>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="sessions.length === 0" class="flex flex-col items-center py-16 text-muted-foreground">
        <Clock class="h-10 w-10 opacity-30 mb-3" />
        <p class="text-sm">No sessions recorded yet</p>
      </div>

      <button
        v-for="s in sessions"
        :key="s.localId"
        type="button"
        class="flex w-full items-center gap-4 border-b border-border/60 px-4 py-3.5 text-left active:bg-secondary"
        @click="navigate(s)"
      >
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
          <BookOpen class="h-4 w-4 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-base font-medium">{{ s.passageRef ?? 'Unknown passage' }}</p>
          <p class="text-xs text-muted-foreground">{{ formatDate(s.startedAt) }} · {{ formatTime(s.startedAt) }}</p>
        </div>
        <!-- Annotation count badge (PRD §5.5) -->
        <div
          v-if="annotationCountFor(s.passageRef) > 0"
          class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
        >
          <Highlighter class="h-3 w-3" />
          {{ annotationCountFor(s.passageRef) }}
        </div>
      </button>
    </div>
  </div>
</template>
