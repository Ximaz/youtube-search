<script setup lang="ts">
// One image-hash filter, generic over its target (video thumbnail OR channel
// avatar). Reads/writes the shared search state via the injected context.
import type { ImageTarget } from '~/types/search'

const props = defineProps<{ target: ImageTarget, label: string }>()
const { f, hashFromUrl, hashFromFile, hashFromPaste, clearImage } = useSearchContext()
const { t } = useI18n()
const image = computed(() => f.images[props.target])
</script>

<template>
  <div class="imgfilter">
    <span class="imglabel">{{ label }}</span>
    <template v-if="!image.phash">
      <input
        type="url"
        :placeholder="t('filters.imagePlaceholder')"
        @paste="hashFromPaste($event, target)"
        @change="hashFromUrl(($event.target as HTMLInputElement).value, target)"
      >
      <input
        type="file"
        accept="image/*"
        @change="hashFromFile($event, target)"
      >
    </template>
    <template v-else>
      <span class="imgok">{{ t('filters.imageSet') }}</span>
      <label class="slider">{{ t('filters.strictness') }}
        <input
          v-model.number="image.threshold"
          type="range"
          min="0"
          max="30"
        >
        <span>{{ image.threshold }}</span>
      </label>
      <button
        class="link"
        @click="clearImage(target)"
      >
        {{ t('common.clear') }}
      </button>
    </template>
  </div>
</template>
