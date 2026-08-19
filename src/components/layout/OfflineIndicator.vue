<script setup>
import { WifiOff, RefreshCw } from 'lucide-vue-next'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()
</script>

<template>
  <transition name="fade-in">
    <div
      v-if="!sync.isOnline || sync.pendingCount > 0"
      class="flex items-center justify-center gap-1.5 bg-muted text-muted-foreground text-xs font-medium py-1.5"
    >
      <WifiOff v-if="!sync.isOnline" class="h-3.5 w-3.5" />
      <RefreshCw v-else class="h-3.5 w-3.5 animate-spin [animation-duration:2s]" />
      <span v-if="!sync.isOnline">Offline — changes saved on this device</span>
      <span v-else>Syncing {{ sync.pendingCount }} change{{ sync.pendingCount === 1 ? '' : 's' }}…</span>
    </div>
  </transition>
</template>
