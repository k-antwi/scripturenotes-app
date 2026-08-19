<script setup>
import { onMounted } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import { useOfflineStatus } from '@/composables/useOfflineStatus'

// Kick off connectivity + Capacitor Network listener once at the root
// so every view can read from the same offline indicator (PRD §5.4).
useOfflineStatus()

onMounted(() => {
  document.documentElement.classList.add('safe-top', 'safe-bottom')
})
</script>

<template>
  <AppShell>
    <router-view v-slot="{ Component, route }">
      <transition name="fade-in" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </router-view>
  </AppShell>
</template>

<style>
.fade-in-enter-active { animation: fade-in 0.15s ease-out; }
</style>
