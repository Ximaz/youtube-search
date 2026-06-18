<script setup lang="ts">
const { f, imageError, scanning, scanInfo, scanComments, reset } = useSearchContext()
</script>

<template>
  <aside class="filters">
    <div class="filters-head">
      <h2>Filters</h2>
      <button
        class="link"
        @click="reset"
      >
        Reset
      </button>
    </div>

    <FilterSection
      title="Search text"
      open
    >
      <label>Title words <small>(partial, any order)</small>
        <input
          v-model="f.title"
          placeholder="e.g. lofi study mix"
        >
      </label>
      <label>Description words <small>(partial, any order)</small>
        <input
          v-model="f.description"
          placeholder="words in description"
        >
      </label>
      <label>Channel name <small>(partial, any order)</small>
        <input
          v-model="f.channelTitle"
          placeholder="channel words"
        >
      </label>
    </FilterSection>

    <FilterSection title="Date published">
      <div>
        <label>From<input
          v-model="f.from"
          type="date"
        ></label>
        <label>To<input
          v-model="f.to"
          type="date"
        ></label>
      </div>
      <label>± days (if unsure)
        <input
          v-model="f.outOfBoundDays"
          type="number"
          min="0"
          placeholder="0"
        >
      </label>
    </FilterSection>

    <FilterSection
      title="Counts &amp; duration"
      hint="(value + tolerance %)"
    >
      <NumberFilter
        label="Views"
        field="views"
      />
      <NumberFilter
        label="Likes"
        field="likes"
      />
      <NumberFilter
        label="Comments"
        field="comments"
      />
      <NumberFilter
        label="Subscribers"
        field="subscribers"
      />
      <div class="numrow">
        <span>Duration</span>
        <input
          v-model="f.duration"
          placeholder="HH:MM:SS"
        >
        <input
          v-model="f.durationTolerancePct"
          type="number"
          min="0"
          max="100"
          placeholder="± %"
        >
      </div>
    </FilterSection>

    <FilterSection
      title="Match by image"
      hint="(perceptual hash)"
    >
      <ImageFilter
        target="thumbnail"
        label="Thumbnail"
      />
      <ImageFilter
        target="avatar"
        label="Channel avatar"
      />
      <p
        v-if="imageError"
        class="error"
      >
        {{ imageError }}
      </p>
    </FilterSection>

    <FilterSection title="My comments">
      <p class="muted hint">
        One fragment per line. "Scan" checks YouTube for your own comments on the current results.
      </p>
      <textarea
        v-model="f.commentTexts"
        rows="3"
        placeholder="words from a comment you left…"
      />
      <label>Match
        <select v-model="f.commentMode">
          <option value="all">all fragments</option>
          <option value="any">any fragment</option>
        </select>
      </label>
      <button
        :disabled="scanning || !f.commentTexts.trim()"
        @click="scanComments"
      >
        {{ scanning ? 'Scanning…' : 'Scan comments' }}
      </button>
      <p
        v-if="scanInfo"
        class="muted hint"
      >
        Scanned {{ scanInfo.scanned }} · found {{ scanInfo.found }} of your comments ·
        {{ scanInfo.remaining }} not yet scanned<span v-if="scanInfo.parked"> · quota paused</span>
      </p>
    </FilterSection>

    <FilterSection
      title="Flags"
      open
    >
      <label>Kind
        <select v-model="f.videoKind">
          <option value="any">Any</option>
          <option value="short">Shorts only</option>
          <option value="video">Regular videos only</option>
        </select>
      </label>
      <label>Subscribed to channel
        <select v-model="f.subscribed">
          <option value="">Any</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <label>Saved in a playlist
        <select v-model="f.saved">
          <option value="">Any</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      <label class="check"><input
        v-model="f.includeUnknownNumeric"
        type="checkbox"
      > Include items with hidden/unknown numbers</label>
      <label class="check"><input
        v-model="f.includeDeleted"
        type="checkbox"
      > Include videos deleted from YouTube</label>
    </FilterSection>

    <label>Sort
      <select v-model="f.sort">
        <option value="published_desc">Newest first</option>
        <option value="published_asc">Oldest first</option>
        <option value="views_desc">Most views</option>
        <option value="likes_desc">Most likes</option>
        <option value="duration_desc">Longest</option>
        <option value="duration_asc">Shortest</option>
      </select>
    </label>
  </aside>
</template>
