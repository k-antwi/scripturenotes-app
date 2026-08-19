<script setup>
import { Clock, BookOpen } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'

const router = useRouter()
const sessions = useObservable(
  () => liveQuery(() => db.studySessions.orderBy('startedAt').reverse().limit(200).toArray()),
  []
)

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
        @click="router.push(s.passageRef ? '/read/' + s.passageRef.replace(' ', '/') : '/')"
      >
        <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary">
          <BookOpen class="h-4 w-4 text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-base font-medium">{{ s.passageRef ?? 'Unknown passage' }}</p>
          <p class="text-xs text-muted-foreground">{{ formatDate(s.startedAt) }} · {{ formatTime(s.startedAt) }}</p>
        </div>
      </button>
    </div>
  </div>
</template>
