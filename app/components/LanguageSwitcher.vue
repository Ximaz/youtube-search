<script setup lang="ts">
import type { Locale } from '~/composables/useI18n'

const { locale, setLocale, locales, t } = useI18n()
</script>

<template>
  <label class="langswitch">
    <span class="sr-only">{{ t('common.language') }}</span>
    <select
      :value="locale"
      :aria-label="t('common.language')"
      @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
    >
      <option
        v-for="l in locales"
        :key="l.code"
        :value="l.code"
      >{{ l.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.langswitch select { padding: .3rem .5rem; border: 1px solid #d0d0d5; border-radius: 8px; background: #fff; font-size: .85rem; cursor: pointer; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
</style>
