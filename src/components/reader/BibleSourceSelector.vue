<!--
  DEPRECATED / UNUSED.

  Switching between the Laravel Bible service and the Free Use Bible API
  (bible.helloao.org) is deploy-time configuration only, via
  VITE_DEFAULT_BIBLE_SOURCE in .env — see src/lib/bibleProviders/index.js
  (ACTIVE_BIBLE_SOURCE). There is deliberately no runtime UI for this, so
  this component is no longer imported anywhere.

  Safe to delete this file — it isn't referenced by ScriptureReader.vue,
  SettingsView.vue, or any other view/component.
-->
<script setup></script>
<template></template>
