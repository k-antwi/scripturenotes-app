<script setup>
import { ref, watch, computed } from 'vue'
import { Loader2, Plus } from 'lucide-vue-next'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNoteStore } from '@/stores/noteStore'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Pre-fill context
  book:      { type: String,  default: null },
  chapter:   { type: Number,  default: null },
  verse:     { type: Number,  default: null },
  charStart: { type: Number,  default: null },
  charEnd:   { type: Number,  default: null },
  // The selected words a phrase-anchored note is about, shown as context.
  quote:     { type: String,  default: null },
  // Pass an existing note to edit it
  editNote:  { type: Object,  default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const noteStore = useNoteStore()
const auth = useAuthStore()

const title = ref('')
const body = ref('')
const selectedNotebookIds = ref([])  // array of localIds
const saving = ref(false)
const newNbName = ref('')
const addingNb = ref(false)
const addNbSaving = ref(false)

// Live notebook list from Dexie (sorted: default first, then alphabetical)
const allNotebooks = useObservable(
  () => liveQuery(() => db.notebooks.orderBy('title').toArray()),
  []
)

const sortedNotebooks = computed(() => {
  return [...allNotebooks.value].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    return a.title.localeCompare(b.title)
  })
})

// Pre-select Untitled Notebook by default
watch(allNotebooks, (nbs) => {
  if (selectedNotebookIds.value.length) return
  const def = nbs.find((n) => n.isDefault)
  if (def) selectedNotebookIds.value = [def.localId]
}, { immediate: true })

// Populate fields when editing an existing note or when modal opens
watch(() => props.modelValue, (open) => {
  if (!open) return
  if (props.editNote) {
    title.value = props.editNote.title ?? ''
    body.value = props.editNote.body ?? ''
    // Load notebook assignments for this note
    db.noteNotebook.where({ noteLocalId: props.editNote.localId }).toArray().then((pivots) => {
      selectedNotebookIds.value = pivots.map((p) => p.notebookLocalId)
      if (!selectedNotebookIds.value.length) {
        const def = allNotebooks.value.find((n) => n.isDefault)
        if (def) selectedNotebookIds.value = [def.localId]
      }
    })
  } else {
    title.value = ''
    body.value = ''
    const def = allNotebooks.value.find((n) => n.isDefault)
    selectedNotebookIds.value = def ? [def.localId] : []
  }
})

function toggleNotebook(localId) {
  const def = allNotebooks.value.find((n) => n.isDefault)
  if (def && localId === def.localId) return  // can't deselect Untitled Notebook
  const idx = selectedNotebookIds.value.indexOf(localId)
  if (idx === -1) {
    selectedNotebookIds.value.push(localId)
  } else {
    selectedNotebookIds.value.splice(idx, 1)
  }
}

async function addNewNotebook() {
  if (!newNbName.value.trim()) return
  addNbSaving.value = true
  const localId = await noteStore.createNotebook(newNbName.value.trim())
  if (localId) selectedNotebookIds.value.push(typeof localId === 'object' ? localId.localId : localId)
  newNbName.value = ''
  addNbSaving.value = false
  addingNb.value = false
}

const dialogTitle = computed(() => {
  if (props.editNote) return 'Edit note'
  return props.quote ? 'Add note on phrase' : 'Add note'
})

async function save() {
  if (!body.value.trim()) return
  saving.value = true
  try {
    if (props.editNote) {
      await noteStore.updateNote(props.editNote.localId, {
        title: title.value.trim() || null,
        body: body.value.trim(),
      })
      // Sync notebook membership
      const existing = await db.noteNotebook.where({ noteLocalId: props.editNote.localId }).toArray()
      const existingIds = existing.map((p) => p.notebookLocalId)
      for (const id of selectedNotebookIds.value) {
        if (!existingIds.includes(id)) {
          await db.noteNotebook.add({ noteLocalId: props.editNote.localId, notebookLocalId: id, dirty: true })
        }
      }
      for (const id of existingIds) {
        if (!selectedNotebookIds.value.includes(id)) {
          const def = allNotebooks.value.find((n) => n.isDefault)
          if (def && id === def.localId) continue  // never remove from Untitled Notebook
          await db.noteNotebook.where({ noteLocalId: props.editNote.localId, notebookLocalId: id }).delete()
        }
      }
    } else {
      await noteStore.saveNote({
        book: props.book,
        chapter: props.chapter,
        verse: props.verse,
        charStart: props.charStart,
        charEnd: props.charEnd,
        title: title.value.trim() || null,
        body: body.value.trim(),
        notebookLocalIds: selectedNotebookIds.value,
      })
    }
    emit('saved')
    emit('update:modelValue', false)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!--
    dismissible=false: a half-written note must survive a stray tap on the
    backdrop or an accidental Escape. Only the X button or Save closes it.
  -->
  <Dialog
    :model-value="modelValue"
    :title="dialogTitle"
    :dismissible="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="flex flex-col gap-4">
      <!-- Selected phrase — the words this note is anchored to -->
      <blockquote
        v-if="quote"
        class="border-l-2 border-accent bg-secondary/60 px-3 py-2 font-scripture text-sm italic text-muted-foreground"
      >
        &ldquo;{{ quote }}&rdquo;
      </blockquote>

      <!-- Title -->
      <Input
        v-model="title"
        placeholder="Title (optional)"
      />

      <!-- Body -->
      <textarea
        v-model="body"
        placeholder="Write your note…"
        rows="5"
        class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      <!-- Notebook selector -->
      <div>
        <p class="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Notebooks</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="nb in sortedNotebooks"
            :key="nb.localId"
            type="button"
            class="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors"
            :class="selectedNotebookIds.includes(nb.localId)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-secondary text-muted-foreground border-border hover:text-foreground'"
            @click="toggleNotebook(nb.localId)"
          >
            {{ nb.title }}
            <span v-if="nb.isDefault" class="opacity-60">🔒</span>
          </button>

          <!-- Add new notebook inline -->
          <button
            v-if="!addingNb"
            type="button"
            class="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-foreground"
            @click="addingNb = true"
          >
            <Plus class="h-3 w-3" /> New
          </button>
        </div>

        <div v-if="addingNb" class="mt-2 flex gap-2">
          <Input
            v-model="newNbName"
            placeholder="Notebook name"
            class="h-7 text-xs"
            autofocus
            @keydown.enter="addNewNotebook"
            @keydown.escape="addingNb = false"
          />
          <Button size="sm" :disabled="!newNbName.trim() || addNbSaving" @click="addNewNotebook">
            <Loader2 v-if="addNbSaving" class="h-3 w-3 animate-spin" />
            <span v-else>Add</span>
          </Button>
        </div>
      </div>

      <!-- Save -->
      <Button class="w-full" :disabled="!body.trim() || saving" @click="save">
        <Loader2 v-if="saving" class="h-4 w-4 animate-spin mr-2" />
        {{ editNote ? 'Save changes' : 'Save note' }}
      </Button>
    </div>
  </Dialog>
</template>
