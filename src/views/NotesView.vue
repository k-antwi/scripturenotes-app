<script setup>
import { ref, computed } from 'vue'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db'
import { useObservable } from '@/composables/useObservable'
import { useSavedNotesStore } from '@/stores/savedNotes'
import { useRouter } from 'vue-router'
import { NotebookPen, BookOpen, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'

const router = useRouter()
const savedNotesStore = useSavedNotesStore()

// ── Live queries ──────────────────────────────────────────────────────────────
const allNotes = useObservable(
  () => liveQuery(() => db.savedNotes.orderBy('updatedAt').reverse().toArray()),
  []
)

const allPassages = useObservable(
  () => liveQuery(() => db.savedNotePassages.toArray()),
  []
)

// ── Search ────────────────────────────────────────────────────────────────────
const query = ref('')

const filteredNotes = computed(() => {
  if (!query.value.trim()) return allNotes.value
  const needle = query.value.toLowerCase()
  return allNotes.value.filter((n) => {
    if (n.name.toLowerCase().includes(needle)) return true
    // Also match if any linked passage ref matches
    return passagesForNote(n.localId).some((p) =>
      p.passageRef?.toLowerCase().includes(needle)
    )
  })
})

// ── Passage helpers ───────────────────────────────────────────────────────────
function passagesForNote(savedNoteLocalId) {
  return allPassages.value
    .filter((p) => p.savedNoteLocalId === savedNoteLocalId)
    .sort((a, b) => (a.savedAt > b.savedAt ? -1 : 1)) // newest first
}

// ── Expand/collapse per note ──────────────────────────────────────────────────
const expandedNoteIds = ref(new Set())

function toggleExpand(localId) {
  const s = new Set(expandedNoteIds.value)
  if (s.has(localId)) s.delete(localId)
  else s.add(localId)
  expandedNoteIds.value = s
}

function isExpanded(localId) {
  return expandedNoteIds.value.has(localId)
}

// ── Actions ───────────────────────────────────────────────────────────────────
/**
 * Navigate to the reader whilst keeping the note context alive so the
 * NotesContextBar can render prev/next passage navigation inside the reader.
 *
 * @param {object} passage  - the savedNotePassage record
 * @param {object} note     - the parent savedNote record (provides noteId)
 */
function openPassage(passage, note) {
  router.push({
    name: 'reader',
    params: { book: passage.book, chapter: passage.chapter },
    query: { noteId: note.localId }
  })
}

async function deleteNote(note) {
  await savedNotesStore.remove(note.localId)
}

function formatDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="flex h-full flex-col safe-top">
    <!-- Header -->
    <div class="border-b border-border px-4 pt-5 pb-3 space-y-3">
      <div>
        <h1 class="text-lg font-semibold">My Notes</h1>
        <p class="text-xs text-muted-foreground mt-0.5">
          Named notes you've saved from the reader — tap a passage to open it
        </p>
      </div>

      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="query" placeholder="Search notes or passages…" class="pl-9" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Empty state -->
      <div
        v-if="filteredNotes.length === 0"
        class="flex flex-col items-center py-16 text-muted-foreground px-6 text-center"
      >
        <NotebookPen class="h-10 w-10 opacity-30 mb-3" />
        <p class="text-sm font-medium">
          {{ query ? 'No notes match your search' : 'No saved notes yet' }}
        </p>
        <p class="text-xs mt-1">
          {{
            query
              ? 'Try a different keyword'
              : 'Open a passage and tap the bookmark icon to save a note'
          }}
        </p>
      </div>

      <!-- Notes list -->
      <div v-else>
        <div
          v-for="note in filteredNotes"
          :key="note.localId"
          class="border-b border-border/60"
        >
          <!-- Note header row -->
          <div class="flex items-center gap-3 px-4 py-3.5">
            <!-- Expand toggle -->
            <button
              type="button"
              class="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              :aria-label="isExpanded(note.localId) ? 'Collapse' : 'Expand'"
              @click="toggleExpand(note.localId)"
            >
              <ChevronDown
                v-if="isExpanded(note.localId)"
                class="h-4 w-4 transition-transform"
              />
              <ChevronRight v-else class="h-4 w-4 transition-transform" />
            </button>

            <!-- Icon -->
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <NotebookPen class="h-4 w-4" />
            </span>

            <!-- Note metadata -->
            <div class="min-w-0 flex-1" @click="toggleExpand(note.localId)">
              <p class="font-medium text-sm text-foreground leading-snug line-clamp-1">
                {{ note.name }}
              </p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-xs text-muted-foreground">
                  {{ passagesForNote(note.localId).length }}
                  passage{{ passagesForNote(note.localId).length === 1 ? '' : 's' }}
                </span>
                <span class="text-muted-foreground/40 text-xs">·</span>
                <span class="text-xs text-muted-foreground">{{ formatDate(note.updatedAt) }}</span>
              </div>
            </div>

            <!-- Delete note -->
            <button
              type="button"
              class="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Delete note"
              @click.stop="deleteNote(note)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </div>

          <!-- Passage sub-rows (shown when expanded) -->
          <div v-if="isExpanded(note.localId)" class="bg-secondary/30">
            <div v-if="passagesForNote(note.localId).length === 0" class="px-14 py-3 text-xs text-muted-foreground">
              No passages yet — add one from the reader.
            </div>

            <button
              v-for="passage in passagesForNote(note.localId)"
              :key="passage.localId"
              type="button"
              class="flex w-full items-center gap-3 border-t border-border/40 px-14 py-2.5 text-left hover:bg-secondary active:bg-secondary transition-colors"
              @click="openPassage(passage, note)"
            >
              <BookOpen class="h-4 w-4 shrink-0 text-primary" />
              <div class="min-w-0 flex-1">
                <p class="text-sm text-foreground font-medium leading-snug">
                  {{ passage.passageRef }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ passage.annotationCount }}
                  annotation{{ passage.annotationCount === 1 ? '' : 's' }}
                  · {{ formatDate(passage.savedAt) }}
                </p>
              </div>
              <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
