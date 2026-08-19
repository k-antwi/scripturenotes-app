<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ScriptureReader from '@/components/reader/ScriptureReader.vue'

const route = useRoute()
const book = computed(() => (route.params.book ?? 'PRO').toUpperCase())
const chapter = computed(() => Number(route.params.chapter ?? 19))
</script>

<template>
  <ScriptureReader :book="book" :chapter="chapter" />
</template>
