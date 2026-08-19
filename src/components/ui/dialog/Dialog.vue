<script setup>
import { DialogRoot, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose } from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

defineProps({ title: { type: String, default: '' }, class: { type: String, default: '' } })
const open = defineModel({ type: Boolean, default: false })
</script>
<template>
  <DialogRoot v-model:open="open">
    <DialogTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" />
    </DialogTrigger>
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
      <DialogContent
        :class="cn(
          'fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 shadow-lg',
          $props.class
        )"
      >
        <div class="flex items-center justify-between mb-3">
          <DialogTitle class="text-base font-semibold">{{ title }}</DialogTitle>
          <DialogClose class="rounded-full p-1.5 hover:bg-secondary">
            <X class="h-4 w-4" />
          </DialogClose>
        </div>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
