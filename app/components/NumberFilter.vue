<script setup lang="ts">
// One numeric "value + tolerance %" filter row, generic over which count field
// it edits. Binds the shared NumericInput via the injected context.
const props = defineProps<{ label: string, field: 'views' | 'likes' | 'comments' | 'subscribers' }>()
const { f } = useSearchContext()
const { t } = useI18n()
const model = computed(() => f[props.field])
</script>

<template>
  <div class="numrow">
    <span>{{ label }}</span>
    <input
      v-model="model.value"
      type="number"
      min="0"
      :placeholder="t('filters.valuePlaceholder')"
    >
    <input
      v-model="model.tolerancePct"
      type="number"
      min="0"
      max="100"
      :placeholder="t('filters.tolerancePlaceholder')"
    >
  </div>
</template>
