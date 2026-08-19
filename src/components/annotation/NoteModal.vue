<script setup>
import { ref, computed, watch } from 'vue'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PRESET_COLOURS } from '@/stores/tool'
import { db } from '@/lib/db'
import AnnotationRepository from '@/lib/annotationRepository'
import { useAuthStore } from '@/stores/auth'
import { liveQuery } from 'dexie'
import { useObservable } from '@/composables/useObservable'

const props = defineProps({
  book: { type: String, required: true },
  chapter: { type: Number, required: true },
  verse: { type: Number, required: null }
})
const open = defineModel({ type: Boolean, default: false })

const auth = useAuthStore()
const text = ref('')
const colour = ref(PRESET_COLOURS[6].hex) // Pink default, matches typed-note example in PRD §8.3
const selectedNotebookIds = ref([])
const newNotebookTitle = ref('')

const notebooks = useObservable(() => liveQuery(() => db.notebooks.toArray()), [])

watch(open, (isOpen) => {
  if (isOpen) {
    text.value = ''
    selectedNotebookIds.value = []
  }
})

const canSave = computed(() => text.value.trim().length > 0)

function toggleNotebook(localId) {
  const idx = selectedNotebookIds.value.indexOf(localId)
  if (idx >= 0) selectedNotebookIds.value.splice(idx, 1)
  else selectedNotebookIds.value.push(localId)
}

async function createNotebookInline() {
  const title = newNotebookTitle.value.trim()
  if (!title) return
  const localId = await db.notebooks.add({
    remoteId: null,
    userId: auth.user?.id ?? 'local',
    title,
    updatedAt: new Date().toISOString(),
    dirty: true
  })
  selectedNotebookIds.value.push(localId)
  newNotebookTitle.value = ''
}

async function save() {
  if (!canSave.value) return
  const annotationLocalId = await AnnotationRepository.create({
    userId: auth.user?.id ?? 'local',
    book: props.book,
    chapter: props.chapter,
    verse: props.verse,
    type: 'note',
    colour: colour.value,
    data: { text: text.value.trim() }
  })
  for (const notebookLocalId of selectedNotebookIds.value) {
    await AnnotationRepository.addToNotebook(annotationLocalId, notebookLocalId)
  }
  open.value = false
}
</script>

<template>
  <Dialog v-model="open" :title="`Note on verse ${verse ?? ''}`">
    <div class="space-y-4">
      <textarea
        v-model="text"
        rows="4"
        placeholder="Prudent wife — gift from God, not earned…"
        class="w-full rounded-md border border-input bg-background p-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <div>
        <p class="text-sm font-medium mb-2">Colour</p>
        <div class="flex gap-2">
          <button
            v-for="c in PRESET_COLOURS"
            :key="c.hex"
            type="button"
            class="h-7 w-7 rounded-full border border-black/10"
            :class="colour === c.hex ? 'ring-2 ring-offset-1 ring-ring' : ''"
            :style="{ background: c.hex }"
            @click="colour = c.hex"
          />
        </div>
      </div>

      <div>
        <p class="text-sm font-medium mb-2">Add to notebook</p>
        <div class="flex flex-wrap gap-2 mb-2">
          <button
            v-for="nb in notebooks"
            :key="nb.localId"
            type="button"
            class="rounded-full border px-3 py-1 text-xs"
            :class="selectedNotebookIds.includes(nb.localId) ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground'"
            @click="toggleNotebook(nb.localId)"
          >
            {{ nb.title }}
          </button>
        </div>
        <div class="flex gap-2">
          <Input v-model="newNotebookTitle" placeholder="New notebook…" class="h-9" />
          <Button size="sm" variant="outline" @click="createNotebookInline">Create</Button>
        </div>
      </div>

      <Button class="w-full" :disabled="!canSave" @click="save">Save note</Button>
    </div>
  </Dialog>
</template>
