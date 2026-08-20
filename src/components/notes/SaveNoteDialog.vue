<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlusCircle } from 'lucide-vue-next'

/**
 * SaveNoteDialog — lets the user save the current passage to a note.
 *
 * If saved notes already exist the user can choose:
 *   • an existing note  → emits { type: 'existing', noteLocalId }
 *   • a new note        → emits { type: 'new', name }
 *
 * Props:
 *   passageRef – e.g. 'Proverbs 19' — shown as context above the options
 */
const props = defineProps({
  passageRef: { type: String, default: '' }
})

const emit = defineEmits(['save'])
const open = defineModel({ type: Boolean, default: false })

// ── State ─────────────────────────────────────────────────────────────────────
/** 'existing' | 'new' */
const mode = ref('new')
const selectedNoteId = ref(null)
const newNoteName = ref('')
const nameInputRef = ref(null)
const errorMsg = ref('')

// Live list of saved notes for the "existing" option
const existingNotes = useObservable(
  () => liveQuery(() => db.savedNotes.orderBy('updatedAt').reverse().toArray()),
  []
)

const hasExisting = computed(() => existingNotes.value.length > 0)

// ── Reset on open ─────────────────────────────────────────────────────────────
watch(open, async (isOpen) => {
  if (!isOpen) return
  // Default to 'existing' mode when notes already exist, otherwise 'new'
  mode.value = hasExisting.value ? 'existing' : 'new'
  selectedNoteId.value = existingNotes.value[0]?.localId ?? null
  newNoteName.value = ''
  errorMsg.value = ''
  if (mode.value === 'new') {
    await nextTick()
    focusNameInput()
  }
})

watch(mode, async (m) => {
  errorMsg.value = ''
  if (m === 'new') {
    await nextTick()
    focusNameInput()
  }
})

function focusNameInput() {
  const el = nameInputRef.value
  if (!el) return
  // shadcn/reka Input wraps the native <input>; try both shapes
  if (typeof el.focus === 'function') el.focus()
  else el.$el?.focus?.()
}

// ── Validation & emit ─────────────────────────────────────────────────────────
function handleSave() {
  if (mode.value === 'existing') {
    if (!selectedNoteId.value) {
      errorMsg.value = 'Please select a note.'
      return
    }
    emit('save', { type: 'existing', noteLocalId: selectedNoteId.value })
    open.value = false
    return
  }

  // New note
  const trimmed = newNoteName.value.trim()
  if (!trimmed) {
    errorMsg.value = 'Please enter a name for the new note.'
    return
  }
  emit('save', { type: 'new', name: trimmed })
  open.value = false
}

function handleKeydown(evt) {
  if (evt.key === 'Enter') handleSave()
}

const canSave = computed(() => {
  if (mode.value === 'existing') return !!selectedNoteId.value
  return newNoteName.value.trim().length > 0
})
</script>

<template>
  <Dialog v-model="open" title="Save to note">
    <div class="space-y-4">
      <!-- Passage context -->
      <p v-if="passageRef" class="text-sm text-muted-foreground -mt-1">
        Adding <span class="font-medium text-foreground">{{ passageRef }}</span> to a note
      </p>

      <!-- Mode tabs — only shown when existing notes are present -->
      <div v-if="hasExisting" class="flex rounded-lg border border-border overflow-hidden text-sm font-medium">
        <button
          type="button"
          class="flex-1 py-2 transition-colors"
          :class="mode === 'existing'
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-muted-foreground hover:text-foreground'"
          @click="mode = 'existing'"
        >
          Existing note
        </button>
        <button
          type="button"
          class="flex-1 py-2 transition-colors border-l border-border"
          :class="mode === 'new'
            ? 'bg-primary text-primary-foreground'
            : 'bg-card text-muted-foreground hover:text-foreground'"
          @click="mode = 'new'"
        >
          New note
        </button>
      </div>

      <!-- Existing note list -->
      <div v-if="mode === 'existing'" class="space-y-1.5">
        <p class="text-sm font-medium">Choose a note</p>
        <div class="max-h-48 overflow-y-auto space-y-1 rounded-md border border-border p-1">
          <button
            v-for="note in existingNotes"
            :key="note.localId"
            type="button"
            class="w-full rounded-md px-3 py-2 text-left text-sm transition-colors"
            :class="selectedNoteId === note.localId
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-secondary text-foreground'"
            @click="selectedNoteId = note.localId"
          >
            {{ note.name }}
          </button>
        </div>
        <p v-if="errorMsg" class="text-xs text-destructive">{{ errorMsg }}</p>
      </div>

      <!-- New note form -->
      <div v-else class="space-y-1.5">
        <label class="text-sm font-medium" for="save-note-name">Note name</label>
        <Input
          id="save-note-name"
          ref="nameInputRef"
          v-model="newNoteName"
          placeholder="e.g. Sunday sermon prep, Week 3 study…"
          maxlength="120"
          @keydown="handleKeydown"
        />
        <p v-if="errorMsg" class="text-xs text-destructive">{{ errorMsg }}</p>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 pt-1">
        <Button variant="outline" class="flex-1" @click="open = false">Cancel</Button>
        <Button class="flex-1" :disabled="!canSave" @click="handleSave">
          <PlusCircle class="mr-1.5 h-3.5 w-3.5" />
          {{ mode === 'existing' ? 'Add to note' : 'Create & save' }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>
