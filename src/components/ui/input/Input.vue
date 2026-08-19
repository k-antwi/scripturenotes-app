<script setup>
import { cn } from '@/lib/utils'
defineProps({ class: { type: String, default: '' } })
defineOptions({ inheritAttrs: false })
const model = defineModel({ type: [String, Number], default: '' })
</script>
<template>
  <input
    v-model="model"
    v-bind="$attrs"
    :class="cn(
      'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      $props.class
    )"
  />
</template>
