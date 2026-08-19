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
      <!--
        FIX: mode="out-in" makes Vue wait for the leaving view to finish
        transitioning before it mounts the next one. Route components here
        are lazy-loaded (`() => import(...)`), and out-in's leave-then-enter
        sequencing never resolved once the incoming component was an async
        chunk — navigating away from the reader (or any route-to-route
        SPA navigation) left the router-view permanently blank with no
        console error, since nothing actually threw. Reproduced with a
        matching `.fade-in-leave-active` animation defined too, so this
        isn't just a missing-CSS issue — out-in itself doesn't play well
        with async route components here. Dropping the mode lets enter/leave
        run concurrently (a normal cross-fade) and navigation works again.
      -->
      <transition name="fade-in">
        <component :is="Component" :key="route.fullPath" />
      </transition>
    </router-view>
  </AppShell>
</template>

<style>
.fade-in-enter-active { animation: fade-in 0.15s ease-out; }
.fade-in-leave-active { animation: fade-in 0.1s ease-in reverse; }
</style>
