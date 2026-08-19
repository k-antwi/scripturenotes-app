<script setup>
import { ref } from 'vue'
import { Check } from 'lucide-vue-next'
import { useToolStore, PRESET_COLOURS } from '@/stores/tool'

const tool = useToolStore()
const customColour = ref('#888888')

function pick(hex) {
  tool.setColour(hex)
}

function pickCustom() {
  tool.setColour(customColour.value)
}
</script>

<template>
  <div class="grid grid-cols-4 gap-3">
    <button
      v-for="c in PRESET_COLOURS"
      :key="c.hex"
      type="button"
      class="relative h-10 w-10 rounded-full border border-black/10 shadow-sm transition-transform active:scale-90"
      :style="{ background: c.hex }"
      :aria-label="c.name"
      @click="pick(c.hex)"
    >
      <Check
        v-if="tool.activeColour.toLowerCase() === c.hex.toLowerCase()"
        class="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
      />
    </button>

    <!-- Custom colour picker via long-press / here: dedicated swatch (PRD §5.2.1) -->
    <label
      class="relative flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-border text-[10px] font-medium text-muted-foreground overflow-hidden cursor-pointer"
      :style="{ background: customColour }"
    >
      <input
        v-model="customColour"
        type="color"
        class="absolute inset-0 opacity-0 cursor-pointer"
        @change="pickCustom"
      />
      <span class="mix-blend-difference text-white">+</span>
    </label>
  </div>
</template>
