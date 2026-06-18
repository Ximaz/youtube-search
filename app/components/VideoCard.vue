<script setup lang="ts">
// Presentational card for one search result.
import type { ResultRow } from '~/types/search'

const props = defineProps<{ row: ResultRow }>()
const watchUrl = `https://www.youtube.com/watch?v=${props.row.id}`
</script>

<template>
  <li class="vcard">
    <a
      :href="watchUrl"
      target="_blank"
      rel="noopener"
      class="thumb"
    >
      <img
        :src="thumbUrl(row)"
        loading="lazy"
        alt=""
      >
      <span
        v-if="row.durationSeconds"
        class="dur"
      >{{ fmtDuration(row.durationSeconds) }}</span>
    </a>
    <div class="vbody">
      <a
        :href="watchUrl"
        target="_blank"
        rel="noopener"
        class="vtitle"
      >{{ row.title || '(untitled)' }}</a>
      <div class="vchannel">
        {{ row.channelTitle || '—' }}
      </div>
      <div class="vmeta">
        {{ fmtCount(row.viewCount) }} views · {{ fmtCount(row.likeCount) }} likes
        <br>
        {{ fmtDate(row.publishedAt) }}
      </div>
      <div class="badges">
        <span
          v-if="row.isShort"
          class="badge short"
        >short</span>
        <span
          v-if="row.saved"
          class="badge saved"
        >saved</span>
        <span
          v-if="row.subscribed"
          class="badge sub"
        >subscribed</span>
        <span
          v-if="row.deletedFromYoutube"
          class="badge del"
        >deleted</span>
      </div>
    </div>
  </li>
</template>
