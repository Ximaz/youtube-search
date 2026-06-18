<script setup lang="ts">
// Owns the search context (provided to the filter/result subtree) and the
// two-column layout. The styles are a global, feature-namespaced stylesheet so
// they reach the child components (scoped styles do not pierce component
// boundaries).
provideVideoSearch()
</script>

<template>
  <div class="workspace">
    <FiltersPanel />
    <ResultsGrid />
  </div>
</template>

<style src="./SearchWorkspace.css"></style>
