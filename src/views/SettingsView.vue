<script setup>
import { ref } from 'vue'
import { LogOut, Download, Loader2, Sun, Moon, BookOpen } from 'lucide-vue-next'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { PassageRepository } from '@/lib/passageRepository'
import { useRouter } from 'vue-router'

const settings = useSettingsStore()
const auth = useAuthStore()
const sync = useSyncStore()
const router = useRouter()

const downloading = ref(false)
const downloadProgress = ref(0)

async function downloadPsalms() {
  downloading.value = true
  await PassageRepository.downloadBook('PSA', 150, settings.defaultTranslation, (p) => {
    downloadProgress.value = Math.round(p * 100)
  })
  downloading.value = false
}

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}

const THEMES = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'sepia', label: 'Sepia', icon: BookOpen },
  { id: 'dark', label: 'Dark', icon: Moon }
]
</script>

<template>
  <div class="h-full overflow-y-auto safe-top">
    <div class="border-b border-border px-4 pt-5 pb-3">
      <h1 class="text-lg font-semibold">Settings</h1>
    </div>

    <div class="space-y-0 pb-8">
      <!-- Theme (PRD §6.2) -->
      <section class="px-4 py-4">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Appearance</h2>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="t in THEMES"
            :key="t.id"
            type="button"
            class="flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm font-medium transition-colors"
            :class="settings.theme === t.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'"
            @click="settings.setTheme(t.id)"
          >
            <component :is="t.icon" class="h-5 w-5" />
            {{ t.label }}
          </button>
        </div>
      </section>

      <Separator />

      <!-- Typography (PRD §6.3) -->
      <section class="px-4 py-4 space-y-5">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typography</h2>

        <div>
          <div class="flex justify-between text-sm mb-2">
            <span>Font size</span>
            <span class="font-mono text-muted-foreground">{{ settings.fontSize }}px</span>
          </div>
          <Slider
            :min="12" :max="24" :step="2"
            :model-value="[settings.fontSize]"
            @update:model-value="(v) => settings.setFontSize(v[0])"
          />
        </div>

        <div>
          <div class="flex justify-between text-sm mb-2">
            <span>Line height</span>
            <span class="font-mono text-muted-foreground">{{ settings.lineHeight.toFixed(1) }}</span>
          </div>
          <Slider
            :min="140" :max="200" :step="10"
            :model-value="[settings.lineHeight * 100]"
            @update:model-value="(v) => settings.setLineHeight(v[0] / 100)"
          />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm">Two-column layout</span>
          <Switch v-model="settings.twoColumnPreferred" />
        </div>
      </section>

      <Separator />

      <!-- Offline / Download (PRD §5.4) -->
      <section class="px-4 py-4 space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offline</h2>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Connection</p>
            <p class="text-xs text-muted-foreground">
              {{ sync.isOnline ? 'Online' : 'Offline' }}
              <template v-if="sync.pendingCount > 0"> · {{ sync.pendingCount }} pending</template>
            </p>
          </div>
          <Badge :variant="sync.isOnline ? 'accent' : 'secondary'">
            {{ sync.isOnline ? 'Online' : 'Offline' }}
          </Badge>
        </div>

        <Button variant="outline" class="w-full gap-2" :disabled="downloading" @click="downloadPsalms">
          <Loader2 v-if="downloading" class="h-4 w-4 animate-spin" />
          <Download v-else class="h-4 w-4" />
          {{ downloading ? `Downloading Psalms… ${downloadProgress}%` : 'Download Psalms for offline' }}
        </Button>
      </section>

      <Separator />

      <!-- Account -->
      <section class="px-4 py-4 space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h2>

        <template v-if="auth.isAuthenticated">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-base font-bold">
              {{ auth.user?.name?.[0]?.toUpperCase() ?? '?' }}
            </div>
            <div>
              <p class="text-sm font-medium">{{ auth.user?.name }}</p>
              <p class="text-xs text-muted-foreground">{{ auth.user?.email }}</p>
            </div>
          </div>
          <Button variant="outline" class="w-full gap-2 text-destructive" @click="logout">
            <LogOut class="h-4 w-4" />
            Sign out
          </Button>
        </template>

        <template v-else>
          <p class="text-sm text-muted-foreground">Sign in to sync annotations across devices.</p>
          <div class="flex gap-2">
            <Button class="flex-1" @click="router.push({ name: 'login' })">Sign in</Button>
            <Button variant="outline" class="flex-1" @click="router.push({ name: 'register' })">Register</Button>
          </div>
        </template>
      </section>

      <Separator />

      <section class="px-4 py-4">
        <p class="text-xs text-muted-foreground text-center">
          Bible Study v0.1 · Scripture: Berean Standard Bible (public domain)
        </p>
      </section>
    </div>
  </div>
</template>
