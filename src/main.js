import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPersist from 'pinia-plugin-persistedstate'
import VueKonva from 'vue-konva'

import App from './App.vue'
import router from './router'
import { useSettingsStore } from './stores/settings'
import { startSyncLoop } from './lib/syncService'
import './assets/tailwind.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPersist)

app.use(pinia)
app.use(router)
app.use(VueKonva)

// Apply persisted theme class to <html> before first paint (PRD §6.2)
const settings = useSettingsStore()
settings.applyTheme()

app.mount('#app')

// Background sync: pushes the offline outbox to Laravel on an interval
// and whenever connectivity returns (PRD §4.1 step 8, §9 Offline).
startSyncLoop()
