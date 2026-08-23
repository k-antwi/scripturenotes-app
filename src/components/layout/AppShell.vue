<script setup>
import { computed } from 'vue'
import { BookOpen, NotebookPen, Bookmark, Clock, Settings } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import OfflineIndicator from './OfflineIndicator.vue'
import { useReadingStore } from '@/stores/reading'

const route = useRoute()
const reading = useReadingStore()

// The Read tab returns to whatever passage the user last had open, rather
// than a fixed chapter — leaving the reader and coming back must not lose
// their place.
const tabs = computed(() => [
  { name: 'reader', label: 'Read', icon: BookOpen, to: reading.lastPassagePath },
  { name: 'notes', label: 'Notes', icon: NotebookPen, to: '/notes' },
  { name: 'bookmarks', label: 'Saved', icon: Bookmark, to: '/bookmarks' },
  { name: 'history', label: 'History', icon: Clock, to: '/history' },
  { name: 'settings', label: 'Settings', icon: Settings, to: '/settings' }
])

/**
 * Determine which bottom-tab is "active".
 *
 * When the reader is opened from the Notes tab (noteId query param present),
 * the Notes tab stays highlighted so the user knows they're still browsing
 * their note — not doing free reading. The Read tab is only active when the
 * reader is used without a note context.
 */
function isActive(tabName) {
  const inNotesContext = route.name === 'reader' && !!route.query.noteId

  if (tabName === 'reader') {
    return (route.name === 'reader' || route.name === 'book-picker') && !inNotesContext
  }
  if (tabName === 'notes') {
    return route.name === 'notes' || inNotesContext
  }
  return route.name === tabName
}
</script>

<template>
  <div class="flex h-[100dvh] flex-col bg-background">
    <OfflineIndicator />

    <main class="flex-1 overflow-hidden">
      <slot />
    </main>

    <nav class="safe-bottom border-t border-border bg-card">
      <ul class="grid grid-cols-5">
        <li v-for="tab in tabs" :key="tab.name">
          <router-link
            :to="tab.to"
            class="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors"
            :class="isActive(tab.name) ? 'text-primary' : 'text-muted-foreground'"
          >
            <component :is="tab.icon" class="h-5 w-5" :stroke-width="isActive(tab.name) ? 2.4 : 2" />
            {{ tab.label }}
          </router-link>
        </li>
      </ul>
    </nav>
  </div>
</template>
