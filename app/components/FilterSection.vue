<script setup lang="ts">
// Generic collapsible filter category. The body is provided via the default slot.
withDefaults(defineProps<{ title: string, hint?: string, open?: boolean }>(), {
  hint: undefined,
  open: false,
})
</script>

<template>
  <details
    class="cat"
    :open="open"
  >
    <summary>{{ title }} <small v-if="hint">{{ hint }}</small></summary>
    <slot />
  </details>
</template>
