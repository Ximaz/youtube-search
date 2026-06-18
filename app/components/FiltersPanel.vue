<script setup lang="ts">
const { f, imageError, scanning, scanInfo, scanComments, reset } = useSearchContext()
const { t } = useI18n()
</script>

<template>
  <aside class="filters">
    <div class="filters-head">
      <h2>{{ t('filters.title') }}</h2>
      <button
        class="link"
        @click="reset"
      >
        {{ t('filters.reset') }}
      </button>
    </div>

    <FilterSection
      :title="t('filters.sections.text')"
      open
    >
      <label>{{ t('filters.titleWords') }} <small>{{ t('filters.partialHint') }}</small>
        <input
          v-model="f.title"
          :placeholder="t('filters.titlePlaceholder')"
        >
      </label>
      <label>{{ t('filters.descWords') }} <small>{{ t('filters.partialHint') }}</small>
        <input
          v-model="f.description"
          :placeholder="t('filters.descPlaceholder')"
        >
      </label>
      <label>{{ t('filters.channelName') }} <small>{{ t('filters.partialHint') }}</small>
        <input
          v-model="f.channelTitle"
          :placeholder="t('filters.channelPlaceholder')"
        >
      </label>
    </FilterSection>

    <FilterSection :title="t('filters.sections.date')">
      <div>
        <label>{{ t('filters.from') }}<input
          v-model="f.from"
          type="date"
        ></label>
        <label>{{ t('filters.to') }}<input
          v-model="f.to"
          type="date"
        ></label>
      </div>
      <label>{{ t('filters.outOfBoundDays') }}
        <input
          v-model="f.outOfBoundDays"
          type="number"
          min="0"
          placeholder="0"
        >
      </label>
    </FilterSection>

    <FilterSection
      :title="t('filters.sections.counts')"
      :hint="t('filters.valueToleranceHint')"
    >
      <NumberFilter
        :label="t('filters.views')"
        field="views"
      />
      <NumberFilter
        :label="t('filters.likes')"
        field="likes"
      />
      <NumberFilter
        :label="t('filters.comments')"
        field="comments"
      />
      <NumberFilter
        :label="t('filters.subscribers')"
        field="subscribers"
      />
      <div class="numrow">
        <span>{{ t('filters.duration') }}</span>
        <input
          v-model="f.duration"
          placeholder="HH:MM:SS"
        >
        <input
          v-model="f.durationTolerancePct"
          type="number"
          min="0"
          max="100"
          :placeholder="t('filters.tolerancePlaceholder')"
        >
      </div>
    </FilterSection>

    <FilterSection
      :title="t('filters.sections.image')"
      :hint="t('filters.perceptualHashHint')"
    >
      <ImageFilter
        target="thumbnail"
        :label="t('filters.thumbnail')"
      />
      <ImageFilter
        target="avatar"
        :label="t('filters.channelAvatar')"
      />
      <p
        v-if="imageError"
        class="error"
      >
        {{ imageError }}
      </p>
    </FilterSection>

    <FilterSection :title="t('filters.sections.comments')">
      <p class="muted hint">
        {{ t('filters.commentsHint') }}
      </p>
      <textarea
        v-model="f.commentTexts"
        rows="3"
        :placeholder="t('filters.commentsPlaceholder')"
      />
      <label>{{ t('filters.match') }}
        <select v-model="f.commentMode">
          <option value="all">{{ t('filters.matchAll') }}</option>
          <option value="any">{{ t('filters.matchAny') }}</option>
        </select>
      </label>
      <button
        :disabled="scanning || !f.commentTexts.trim()"
        @click="scanComments"
      >
        {{ scanning ? t('filters.scanning') : t('filters.scanComments') }}
      </button>
      <p
        v-if="scanInfo"
        class="muted hint"
      >
        {{ t('filters.scanResult', { scanned: scanInfo.scanned, found: scanInfo.found, remaining: scanInfo.remaining }) }}<span v-if="scanInfo.parked">{{ t('filters.quotaPaused') }}</span>
      </p>
    </FilterSection>

    <FilterSection
      :title="t('filters.sections.flags')"
      open
    >
      <label>{{ t('filters.kind') }}
        <select v-model="f.videoKind">
          <option value="any">{{ t('filters.kindAny') }}</option>
          <option value="short">{{ t('filters.kindShort') }}</option>
          <option value="video">{{ t('filters.kindVideo') }}</option>
        </select>
      </label>
      <label>{{ t('filters.subscribed') }}
        <select v-model="f.subscribed">
          <option value="">{{ t('common.any') }}</option>
          <option value="yes">{{ t('common.yes') }}</option>
          <option value="no">{{ t('common.no') }}</option>
        </select>
      </label>
      <label>{{ t('filters.saved') }}
        <select v-model="f.saved">
          <option value="">{{ t('common.any') }}</option>
          <option value="yes">{{ t('common.yes') }}</option>
          <option value="no">{{ t('common.no') }}</option>
        </select>
      </label>
      <label class="check"><input
        v-model="f.includeUnknownNumeric"
        type="checkbox"
      > {{ t('filters.includeUnknown') }}</label>
      <label class="check"><input
        v-model="f.includeDeleted"
        type="checkbox"
      > {{ t('filters.includeDeleted') }}</label>
    </FilterSection>

    <label>{{ t('filters.sort') }}
      <select v-model="f.sort">
        <option value="published_desc">{{ t('filters.sortNewest') }}</option>
        <option value="published_asc">{{ t('filters.sortOldest') }}</option>
        <option value="views_desc">{{ t('filters.sortViews') }}</option>
        <option value="likes_desc">{{ t('filters.sortLikes') }}</option>
        <option value="duration_desc">{{ t('filters.sortLongest') }}</option>
        <option value="duration_asc">{{ t('filters.sortShortest') }}</option>
      </select>
    </label>
  </aside>
</template>
