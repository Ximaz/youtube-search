<script setup lang="ts">
// Presentational card for one search result.
import type { ResultRow } from '~/types/search'

const props = defineProps<{ row: ResultRow }>()
const watchUrl = `https://www.youtube.com/watch?v=${props.row.id}`
const { t, tc, fmtCount, fmtDate } = useI18n()
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
      >{{ row.title || t('video.untitled') }}</a>
      <div class="vchannel">
        {{ row.channelTitle || '—' }}
      </div>
      <div class="vmeta">
        {{ fmtCount(row.viewCount) }} {{ tc('video.viewsNoun', row.viewCount ?? 0) }} · {{ fmtCount(row.likeCount) }} {{ tc('video.likesNoun', row.likeCount ?? 0) }}
        <br>
        {{ fmtDate(row.publishedAt) }}
      </div>
      <div class="badges">
        <span
          v-if="row.isShort"
          class="badge short"
        >{{ t('video.badge.short') }}</span>
        <span
          v-if="row.saved"
          class="badge saved"
        >{{ t('video.badge.saved') }}</span>
        <span
          v-if="row.subscribed"
          class="badge sub"
        >{{ t('video.badge.subscribed') }}</span>
        <span
          v-if="row.deletedFromYoutube"
          class="badge del"
        >{{ t('video.badge.deleted') }}</span>
      </div>
    </div>
  </li>
</template>
