<script setup>
import { ref } from 'vue'
import { BookMarked, Lock, Plus, Loader2 } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth'
import { NotebookAPI } from '@/lib/api'

const router = useRouter()
const auth = useAuthStore()

// Sort: default (Untitled) first, then alphabetical
const notebooks = useObservable(
  () => liveQuery(() =>
    db.notebooks.toArray().then((nbs) =>
      nbs.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1
        if (!a.isDefault && b.isDefault) return 1
        return a.title.localeCompare(b.title)
      })
    )
  ),
  []
)

const createOpen = ref(false)
const newTitle = ref('')
const saving = ref(false)

async function createNotebook() {
  if (!newTitle.value.trim()) return
  saving.value = true
  const localId = await db.notebooks.add({
    remoteId: null,
    userId: auth.user?.id ?? 'local',
    isDefault: 0,
    title: newTitle.value.trim(),
    updatedAt: new Date().toISOString(),
    dirty: true,
  })

  await db.syncQueue.add({
    entityType: 'notebook',
    entityLocalId: localId,
    action: 'create',
    createdAt: new Date().toISOString(),
    attempts: 0,
  })

  // Optimistic push
  try {
    const { data } = await NotebookAPI.create({ title: newTitle.value.trim() })
    await db.notebooks.update(localId, { remoteId: data.id, dirty: false })
    await db.syncQueue.where({ entityType: 'notebook', entityLocalId: localId }).delete()
  } catch {
    // Will sync later
  }

  newTitle.value = ''
  saving.value = false
  createOpen.value = false
}

async function deleteNotebook(nb) {
  if (nb.isDefault) return  // Untitled Notebook cannot be deleted

  // Remove pivot rows and notebook locally
  await db.noteNotebook.where({ notebookLocalId: nb.localId }).delete()
  await db.annotationNotebook.where({ notebookLocalId: nb.localId }).delete()
  await db.notebooks.delete(nb.localId)

  if (nb.remoteId) {
    try {
      await NotebookAPI.destroy(nb.remoteId)
    } catch {
      // Tolerate — server delete can be retried via syncQueue if needed
    }
  }
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

      <div
        v-for="nb in notebooks"
        :key="nb.localId"
        class="flex w-full items-center gap-4 border-b border-border/60 px-4 py-4 active:bg-secondary"
      >
        <!-- Tap to open detail -->
        <button
          type="button"
          class="flex flex-1 items-center gap-4 text-left"
          @click="router.push({ name: 'notebook-detail', params: { id: nb.localId } })"
        >
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <BookMarked class="h-5 w-5 text-primary" />
          </div>
          <div>
            <p class="flex items-center gap-1.5 text-base font-medium">
              {{ nb.title }}
              <Lock v-if="nb.isDefault" class="h-3 w-3 text-muted-foreground opacity-60" />
            </p>
            <p v-if="nb.dirty" class="text-xs text-muted-foreground">Not synced yet</p>
          </div>
        </button>

        <!-- Delete button — hidden for default notebook -->
        <button
          v-if="!nb.isDefault"
          type="button"
          class="text-muted-foreground hover:text-destructive transition-colors p-1"
          aria-label="Delete notebook"
          @click="deleteNotebook(nb)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
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
