<script setup>
import { SelectRoot, SelectTrigger, SelectValue, SelectIcon, SelectPortal, SelectContent, SelectViewport, SelectItem, SelectItemText, SelectItemIndicator } from 'reka-ui'
import { ChevronDown, Check } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

defineProps({
  options: { type: Array, required: true }, // [{ value, label }]
  placeholder: { type: String, default: 'Select…' },
  class: { type: String, default: '' }
})
const model = defineModel({ type: String, default: '' })
</script>
<template>
  <SelectRoot v-model="model">
    <SelectTrigger
      :class="cn(
        'flex h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring',
        $props.class
      )"
    >
      <SelectValue :placeholder="placeholder" />
      <SelectIcon><ChevronDown class="h-4 w-4 opacity-60" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="z-50 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md" position="popper" :side-offset="4">
        <SelectViewport class="p-1 max-h-72">
          <SelectItem
            v-for="opt in options"
            :key="opt.value"
            :value="opt.value"
            class="relative flex cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-secondary"
          >
            <SelectItemIndicator class="absolute left-2 inline-flex items-center">
              <Check class="h-4 w-4" />
            </SelectItemIndicator>
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
