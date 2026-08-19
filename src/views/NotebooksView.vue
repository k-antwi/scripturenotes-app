<script setup>
import { ref } from 'vue'
import { BookMarked, Plus, Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const notebooks = useObservable(() => liveQuery(() => db.notebooks.orderBy('title').toArray()), [])

const createOpen = ref(false)
const newTitle = ref('')
const saving = ref(false)

async function createNotebook() {
  if (!newTitle.value.trim()) return
  saving.value = true
  await db.notebooks.add({
    remoteId: null,
    userId: auth.user?.id ?? 'local',
    title: newTitle.value.trim(),
    updatedAt: new Date().toISOString(),
    dirty: true
  })
  newTitle.value = ''
  saving.value = false
  createOpen.value = false
}

async function countAnnotations(nb) {
  return db.annotationNotebook.where({ notebookLocalId: nb.localId }).count()
}
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <div class="flex items-center gap-3 border-b border-border px-4 pt-5 pb-3">
      <h1 class="flex-1 text-lg font-semibold">Notebooks</h1>
      <Button size="sm" variant="outline" @click="createOpen = true">
        <Plus class="h-4 w-4 mr-1" /> New
      </Button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="notebooks.length === 0" class="flex flex-col items-center py-16 text-muted-foreground">
        <BookMarked class="h-10 w-10 opacity-30 mb-3" />
        <p class="text-sm">No notebooks yet</p>
        <p class="text-xs mt-1">Create one to organise your annotations</p>
      </div>

      <button
        v-for="nb in notebooks"
        :key="nb.localId"
        type="button"
        class="flex w-full items-center gap-4 border-b border-border/60 px-4 py-4 text-left active:bg-secondary"
        @click="router.push({ name: 'notebook-detail', params: { id: nb.localId } })"
      >
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
          <BookMarked class="h-5 w-5 text-primary" />
        </div>
        <div>
          <p class="text-base font-medium">{{ nb.title }}</p>
          <p v-if="nb.dirty" class="text-xs text-muted-foreground">Not synced yet</p>
        </div>
      </button>
    </div>

    <Dialog v-model="createOpen" title="New notebook">
      <div class="space-y-3">
        <Input v-model="newTitle" placeholder="e.g. Sunday Sermon Prep" autofocus />
        <Button class="w-full" :disabled="!newTitle.trim() || saving" @click="createNotebook">
          <Loader2 v-if="saving" class="h-4 w-4 animate-spin mr-2" />
          Create notebook
        </Button>
      </div>
    </Dialog>
  </div>
</template>
