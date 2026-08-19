<script setup>
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { cn } from '@/lib/utils'
defineProps({ contentClass: { type: String, default: '' }, align: { type: String, default: 'center' } })
</script>
<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :align="align"
        :side-offset="8"
        :class="cn(
          'z-50 w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-fade-in',
          contentClass
        )"
      >
        <slot name="content" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
