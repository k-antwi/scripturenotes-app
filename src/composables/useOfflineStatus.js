import { onMounted, onUnmounted } from 'vue'
import { Network } from '@capacitor/network'
import { useSyncStore } from '@/stores/sync'

/**
 * Drives the offline indicator shown in the status bar (PRD §5.4).
 */
export function useOfflineStatus() {
  const syncStore = useSyncStore()
  let handle

  onMounted(async () => {
    const status = await Network.getStatus()
    syncStore.isOnline = status.connected
    await syncStore.refreshPendingCount()

    handle = await Network.addListener('networkStatusChange', (status) => {
      syncStore.isOnline = status.connected
    })
  })

  onUnmounted(() => {
    handle?.remove()
  })

  return syncStore
}
