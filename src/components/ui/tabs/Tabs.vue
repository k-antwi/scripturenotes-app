<script setup>
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from 'reka-ui'
import { cn } from '@/lib/utils'

defineProps({
  tabs: { type: Array, required: true } // [{ value, label }]
})
const model = defineModel({ type: String, default: '' })
</script>
<template>
  <TabsRoot v-model="model">
    <TabsList class="inline-flex h-11 items-center justify-center rounded-md bg-secondary p-1 text-secondary-foreground w-full">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.value"
        :value="tab.value"
        :class="cn(
          'inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
          'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm'
        )"
      >
        {{ tab.label }}
      </TabsTrigger>
    </TabsList>
    <TabsContent v-for="tab in tabs" :key="tab.value" :value="tab.value" class="mt-3 focus-visible:outline-none">
      <slot :name="tab.value" />
    </TabsContent>
  </TabsRoot>
</template>
