<script setup>
import { Slider } from '@/components/ui/slider'
import { useToolStore, STROKE_WIDTHS } from '@/stores/tool'
import { useSettingsStore } from '@/stores/settings'

const tool = useToolStore()
const settings = useSettingsStore()

const widthOptions = Object.keys(STROKE_WIDTHS)

function opacityModel() {
  return {
    get: () => [Math.round(tool.opacity * 100)],
    set: (v) => (tool.opacity = v[0] / 100)
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-sm font-medium mb-2">Stroke width</p>
      <div class="flex gap-2">
        <button
          v-for="key in widthOptions"
          :key="key"
          type="button"
          class="flex-1 rounded-md border py-2 text-xs font-medium capitalize transition-colors"
          :class="tool.strokeWidthKey === key ? 'border-primary bg-primary/10 text-primary' : 'border-input'"
          @click="tool.setStrokeWidth(key)"
        >
          {{ key }}
        </button>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <p class="text-sm font-medium">Opacity</p>
        <span class="text-xs text-muted-foreground">{{ Math.round(tool.opacity * 100) }}%</span>
      </div>
      <Slider :min="20" :max="100" :step="5" :model-value="[tool.opacity * 100]" @update:model-value="(v) => (tool.opacity = v[0] / 100)" />
    </div>

    <div class="border-t border-border pt-4">
      <p class="text-sm font-medium mb-2">Pen feel</p>
      <div class="space-y-3">
        <div>
          <div class="flex items-center justify-between mb-1 text-xs text-muted-foreground">
            <span>Thinning</span><span>{{ settings.penFeel.thinning.toFixed(2) }}</span>
          </div>
          <Slider
            :min="0" :max="100" :step="5"
            :model-value="[settings.penFeel.thinning * 100]"
            @update:model-value="(v) => (settings.penFeel.thinning = v[0] / 100)"
          />
        </div>
        <div>
          <div class="flex items-center justify-between mb-1 text-xs text-muted-foreground">
            <span>Smoothing</span><span>{{ settings.penFeel.smoothing.toFixed(2) }}</span>
          </div>
          <Slider
            :min="0" :max="100" :step="5"
            :model-value="[settings.penFeel.smoothing * 100]"
            @update:model-value="(v) => (settings.penFeel.smoothing = v[0] / 100)"
          />
        </div>
        <div>
          <div class="flex items-center justify-between mb-1 text-xs text-muted-foreground">
            <span>Streamline</span><span>{{ settings.penFeel.streamline.toFixed(2) }}</span>
          </div>
          <Slider
            :min="0" :max="100" :step="5"
            :model-value="[settings.penFeel.streamline * 100]"
            @update:model-value="(v) => (settings.penFeel.streamline = v[0] / 100)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
