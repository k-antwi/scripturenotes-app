<script setup>
import { SliderRoot, SliderTrack, SliderRange, SliderThumb } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps({
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
  class: { type: String, default: '' }
})
// Used for opacity slider (20%-100%) and font-size stepper (PRD §5.2.2, §6.3)
const model = defineModel({ type: Array, default: () => [0] })
</script>
<template>
  <SliderRoot
    v-model="model"
    :min="min"
    :max="max"
    :step="step"
    :class="cn('relative flex w-full touch-none select-none items-center', props.class)"
  >
    <SliderTrack class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      class="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  </SliderRoot>
</template>
