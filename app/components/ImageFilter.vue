<script setup lang="ts">
// One image-hash filter, generic over its target (video thumbnail OR channel
// avatar). Reads/writes the shared search state via the injected context.
import type { ImageTarget } from '~/types/search'

const props = defineProps<{ target: ImageTarget, label: string }>()
const { f, hashFromUrl, hashFromFile, hashFromPaste, clearImage } = useSearchContext()
const image = computed(() => f.images[props.target])
</script>

<template>
  <div class="imgfilter">
    <span class="imglabel">{{ label }}</span>
    <template v-if="!image.phash">
      <input
        type="url"
        placeholder="paste image or type URL"
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
      <span class="imgok">✓ image set</span>
      <label class="slider">strictness
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
        Clear
      </button>
    </template>
  </div>
</template>
