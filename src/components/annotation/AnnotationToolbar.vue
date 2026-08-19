<script setup>
import { ref, watch } from 'vue'
import {
  Highlighter, PenLine, Underline, Circle, Type, Eraser, X, Settings2
} from 'lucide-vue-next'
import { Popover } from '@/components/ui/popover'
import { Sheet } from '@/components/ui/sheet'
import ColourPalette from './ColourPalette.vue'
import StrokeSettingsPanel from './StrokeSettingsPanel.vue'
import { useToolStore, TOOLS } from '@/stores/tool'

const tool = useToolStore()
const expanded = ref(false)
const strokeSheetOpen = ref(false)

const toolItems = [
  { id: TOOLS.HIGHLIGHTER, icon: Highlighter, label: 'Highlight' },
  { id: TOOLS.PEN,         icon: PenLine,    label: 'Pen' },
  { id: TOOLS.UNDERLINE,   icon: Underline,  label: 'Underline' },
  { id: TOOLS.SHAPE,       icon: Circle,     label: 'Shape' },
  { id: TOOLS.NOTE,        icon: Type,       label: 'Note' },
  { id: TOOLS.ERASER,      icon: Eraser,     label: 'Erase' }
]

function selectTool(id) {
  if (tool.activeTool === id) {
    // Tapping the active tool deactivates it
    tool.reset()
  } else {
    tool.setTool(id)
  }
  // FIX: collapse the tray after picking a tool — the FAB now shows which
  // tool is active, so the tray doesn't need to stay open.
  expanded.value = false
}

function openTray() {
  expanded.value = true
}

function dismiss() {
  expanded.value = false
  tool.reset()
}

// If the tool is reset from outside (e.g. note modal saves), also collapse
watch(() => tool.activeTool, (val) => {
  if (val === TOOLS.NONE) expanded.value = false
})

const activeToolItem = ref(null)
watch(() => tool.activeTool, (val) => {
  activeToolItem.value = toolItems.find((t) => t.id === val) ?? null
})
</script>

<template>
  <!--
    FIX: this div is NOT absolute — it is a static element inside the reader's
    flex column so it doesn't need to fight z-index with the canvas.
    The floating buttons are positioned absolute *within* this overlay div.
  -->
  <div class="pointer-events-none absolute inset-0 z-30 overflow-hidden">
    <!-- Pen Feel / Stroke Settings sheet -->
    <Sheet v-model="strokeSheetOpen" title="Pen settings" side="bottom">
      <StrokeSettingsPanel />
    </Sheet>

    <!-- Tool tray — slides up from the FAB -->
    <transition
      enter-active-class="transition-all duration-200 ease-out origin-bottom-right"
      enter-from-class="opacity-0 scale-90 translate-y-2"
      leave-active-class="transition-all duration-150 ease-in origin-bottom-right"
      leave-to-class="opacity-0 scale-90 translate-y-2"
    >
      <div
        v-if="expanded"
        class="pointer-events-auto absolute bottom-20 right-4 flex flex-col items-end gap-2"
      >
        <!-- Stroke settings shortcut (pen tool only) -->
        <button
          v-if="tool.activeTool === TOOLS.PEN"
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-md"
          @click="strokeSheetOpen = true; expanded = false"
        >
          <Settings2 class="h-5 w-5 text-muted-foreground" />
        </button>

        <!-- Colour swatch -->
        <Popover
          v-if="tool.activeTool !== TOOLS.ERASER && tool.activeTool !== TOOLS.NONE"
          align="end"
          content-class="w-auto p-3"
        >
          <template #trigger>
            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-md"
            >
              <span
                class="h-6 w-6 rounded-full border border-black/10 shadow-inner"
                :style="{ background: tool.activeColour }"
              />
            </button>
          </template>
          <template #content>
            <ColourPalette />
          </template>
        </Popover>

        <!-- Tool buttons -->
        <div class="flex flex-col items-end gap-2">
          <div
            v-for="t in toolItems"
            :key="t.id"
            class="flex items-center gap-2"
          >
            <span class="rounded-md bg-card/90 px-2 py-0.5 text-xs font-medium text-foreground shadow backdrop-blur-sm">
              {{ t.label }}
            </span>
            <button
              type="button"
              class="flex h-12 w-12 items-center justify-center rounded-full border shadow-md transition-colors"
              :class="tool.activeTool === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-secondary'"
              :aria-label="t.label"
              @click="selectTool(t.id)"
            >
              <component :is="t.icon" class="h-5 w-5" />
            </button>
          </div>
        </div>

        <!-- Close tray -->
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-md"
          @click="dismiss"
        >
          <X class="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </transition>

    <!--
      FAB — opens the tray on first tap, shows current active tool icon.
      Gold ring when a tool is active.
    -->
    <button
      type="button"
      class="pointer-events-auto absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all"
      :class="tool.activeTool !== TOOLS.NONE
        ? 'bg-primary text-primary-foreground ring-2 ring-accent ring-offset-2'
        : 'bg-card border border-border text-foreground'"
      :aria-label="expanded ? 'Close annotation tools' : (tool.activeTool !== TOOLS.NONE ? 'Change tool' : 'Open annotation tools')"
      @click="openTray"
    >
      <component
        :is="activeToolItem?.icon ?? PenLine"
        class="h-6 w-6"
      />
    </button>
  </div>
</template>
