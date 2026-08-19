<script setup>
import { computed } from 'vue'
import { X } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'

const props = defineProps({
  notes: { type: Object, default: null },
  targetVerse: { type: Number, default: null }
})

const emit = defineEmits(['close', 'navigate-ref'])

// Filter study notes to the tapped verse (PRD §5.3)
const activeNotes = computed(() => {
  if (!props.notes?.notes) return []
  if (props.targetVerse == null) return props.notes.notes.slice(0, 3)
  return props.notes.notes.filter((n) => n.verse === props.targetVerse)
})

function navigateCrossRef(refText) {
  emit('navigate-ref', refText)
}

/** Render <ref> tags inside note bodies as tappable spans */
function renderBody(body) {
  return body.replace(
    /<ref>(.*?)<\/ref>/g,
    '<button class="cross-ref text-accent underline underline-offset-2 text-sm" onclick="void(0)">$1</button>'
  )
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between px-4 py-3 border-b border-border">
      <p class="text-sm font-semibold text-muted-foreground">
        Study Notes
        <Badge v-if="targetVerse" variant="accent" class="ml-2 font-mono text-xs">
          v.{{ targetVerse }}
        </Badge>
      </p>
      <button type="button" class="rounded-full p-1.5 hover:bg-secondary" @click="emit('close')">
        <X class="h-4 w-4" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-5">
      <template v-if="activeNotes.length">
        <div
          v-for="note in activeNotes"
          :key="note.verse"
          class="space-y-2"
        >
          <!-- Verse reference header, coloured like PRD §5.3 description -->
          <h3 class="font-sans text-sm font-bold text-accent">
            {{ notes.chapter }}:{{ note.verse }}
          </h3>
          <div
            class="scripture-text text-[15px] leading-relaxed text-foreground"
            @click="(evt) => { if (evt.target.classList.contains('cross-ref')) navigateCrossRef(evt.target.textContent) }"
            v-html="renderBody(note.body)"
          />
        </div>
      </template>

      <div v-else class="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <p class="text-sm">Tap a verse number to see its study note.</p>
      </div>
    </div>
  </div>
</template>
