<script setup>
import { BookOpen, Highlighter, Bookmark, Clock, Settings } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import OfflineIndicator from './OfflineIndicator.vue'

const route = useRoute()

const tabs = [
  { name: 'reader', label: 'Read', icon: BookOpen, to: '/read/PRO/19' },
  { name: 'annotations', label: 'Notes', icon: Highlighter, to: '/annotations' },
  { name: 'bookmarks', label: 'Saved', icon: Bookmark, to: '/bookmarks' },
  { name: 'history', label: 'History', icon: Clock, to: '/history' },
  { name: 'settings', label: 'Settings', icon: Settings, to: '/settings' }
]

function isActive(tabName) {
  if (tabName === 'reader') return route.name === 'reader' || route.name === 'book-picker'
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
