<script setup>
import { ref } from 'vue'
import { Bookmark, BookOpen, Trash2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'

const router = useRouter()
const bookmarks = useObservable(() => liveQuery(() => db.bookmarks.orderBy('updatedAt').reverse().toArray()), [])

async function remove(bk) {
  await db.bookmarks.delete(bk.localId)
  await db.syncQueue.add({ entityType: 'bookmark', entityLocalId: bk.localId, action: 'delete', createdAt: new Date().toISOString(), attempts: 0 })
}
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <div class="border-b border-border px-4 pt-5 pb-3">
      <h1 class="text-lg font-semibold">Saved passages</h1>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="bookmarks.length === 0" class="flex flex-col items-center py-16 text-muted-foreground">
        <Bookmark class="h-10 w-10 opacity-30 mb-3" />
        <p class="text-sm">No bookmarks yet</p>
        <p class="text-xs mt-1">Long-press a verse to save a bookmark</p>
      </div>

      <div
        v-for="bk in bookmarks"
        :key="bk.localId"
        class="flex items-center border-b border-border/60 px-4 py-4"
      >
        <button
          type="button"
          class="flex flex-1 items-center gap-3 text-left"
          @click="router.push({ name: 'reader', params: { book: bk.book, chapter: bk.chapter } })"
        >
          <BookOpen class="h-5 w-5 shrink-0 text-accent" />
          <div>
            <p class="text-base font-medium">{{ bk.book }} {{ bk.chapter }}:{{ bk.verse }}</p>
            <p v-if="bk.label" class="text-sm text-muted-foreground">{{ bk.label }}</p>
          </div>
        </button>
        <button type="button" class="p-2 text-muted-foreground hover:text-destructive" @click="remove(bk)">
          <Trash2 class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>
