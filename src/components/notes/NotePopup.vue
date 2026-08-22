<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, Trash2, ArrowRight, X } from 'lucide-vue-next'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNoteStore } from '@/stores/noteStore'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  notes: { type: Array, default: () => [] },  // all notes on this verse/phrase
})

const emit = defineEmits(['update:modelValue', 'edit'])

const router = useRouter()
const noteStore = useNoteStore()

const activeIndex = ref(0)
watch(() => props.notes, () => { activeIndex.value = 0 })

const activeNote = computed(() => props.notes[activeIndex.value] ?? null)

const reference = computed(() => {
  if (!activeNote.value?.book) return null
  const base = `${activeNote.value.book} ${activeNote.value.chapter}`
  return activeNote.value.verse ? `${base}:${activeNote.value.verse}` : base
})

function close() {
  emit('update:modelValue', false)
}

async function handleDelete() {
  if (!activeNote.value) return
  await noteStore.deleteNote(activeNote.value.localId)
  if (props.notes.length <= 1) {
    close()
  } else {
    activeIndex.value = Math.max(0, activeIndex.value - 1)
  }
}

function handleEdit() {
  emit('edit', activeNote.value)
  close()
}

function goToPassage() {
  if (!activeNote.value?.book) return
  router.push({
    name: 'reader',
    params: { book: activeNote.value.book, chapter: activeNote.value.chapter },
  })
  close()
}
</script>

<template>
  <Sheet :model-value="modelValue" side="bottom" title="Note" @update:model-value="close">
    <div v-if="activeNote" class="flex flex-col gap-4 pb-4">
      <!-- Multi-note tabs -->
      <div v-if="notes.length > 1" class="flex gap-1.5 flex-wrap">
        <button
          v-for="(n, i) in notes"
          :key="n.localId"
          type="button"
          class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
          :class="i === activeIndex
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground hover:text-foreground'"
          @click="activeIndex = i"
        >
          Note {{ i + 1 }}
        </button>
      </div>

      <!-- Selected phrase — present on phrase-anchored notes -->
      <blockquote
        v-if="activeNote.quote"
        class="border-l-2 border-accent bg-secondary/60 px-3 py-2 font-scripture text-sm italic text-muted-foreground"
      >
        &ldquo;{{ activeNote.quote }}&rdquo;
      </blockquote>

      <!-- Title -->
      <h2 v-if="activeNote.title" class="text-base font-semibold text-foreground">
        {{ activeNote.title }}
      </h2>

      <!-- Body -->
      <p class="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
        {{ activeNote.body }}
      </p>

      <!-- Scripture reference badge -->
      <div v-if="reference" class="flex items-center gap-2">
        <Badge variant="secondary" class="font-mono text-xs">{{ reference }}</Badge>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between gap-2 pt-1">
        <!-- Go to passage -->
        <Button
          v-if="activeNote.book"
          size="sm"
          variant="outline"
          class="gap-1.5"
          @click="goToPassage"
        >
          Go to passage <ArrowRight class="h-3.5 w-3.5" />
        </Button>
        <span v-else />

        <div class="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Edit note" @click="handleEdit">
            <Pencil class="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" class="text-destructive" aria-label="Delete note" @click="handleDelete">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  </Sheet>
</template>
