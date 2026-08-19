<script setup>
import { Select } from '@/components/ui/select'

// v1 public-domain translations only (PRD §11.5)
// Copyrighted translations (ESV, NIV, NKJV) deferred post-launch.
const TRANSLATIONS = [
  { value: 'BSB',  label: 'BSB — Berean Standard Bible' },
  { value: 'KJV',  label: 'KJV — King James Version' },
  { value: 'ASV',  label: 'ASV — American Standard' }
]

const model = defineModel({ type: String, default: 'BSB' })
</script>

<template>
  <Select
    v-model="model"
    :options="TRANSLATIONS"
    placeholder="Translation…"
    class="text-sm h-9 w-44"
  />
</template>
