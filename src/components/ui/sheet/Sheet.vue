<script setup>
import { DialogRoot, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogClose } from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

/**
 * Bottom sheet — used for the notes panel on mobile portrait and the
 * annotation tool tray (PRD §5.3 "full-screen on mobile", §6.1).
 */
const props = defineProps({
  title: { type: String, default: '' },
  side: { type: String, default: 'bottom' }, // bottom | right
  fullScreen: { type: Boolean, default: false }
})
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
          'fixed z-50 bg-background border-border shadow-lg flex flex-col',
          side === 'bottom' && [
            'inset-x-0 bottom-0 rounded-t-2xl border-t safe-bottom',
            fullScreen ? 'top-0 rounded-t-none' : 'max-h-[85vh]'
          ],
          side === 'right' && 'inset-y-0 right-0 w-[85vw] max-w-md border-l'
        )"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <DialogTitle class="text-base font-semibold">{{ title }}</DialogTitle>
          <DialogClose class="rounded-full p-2 hover:bg-secondary">
            <X class="h-5 w-5" />
          </DialogClose>
        </div>
        <div class="overflow-y-auto p-4 flex-1">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
