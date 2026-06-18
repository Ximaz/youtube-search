<script setup lang="ts">
const { f, results, total, loading, loadingMore, error, loadMore } = useSearchContext()
const { t, tc } = useI18n()

// The infinite-scroll sentinel lives here, so this component owns the observer
// that prefetches the next page as it nears the viewport.
const sentinel = useTemplateRef<HTMLElement>('sentinel')
let observer: IntersectionObserver | null = null
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) void loadMore()
  }, { rootMargin: '600px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <section class="results">
    <div class="results-head">
      <p>
        <strong>{{ total }}</strong> {{ tc('results.matchNoun', total) }}
        <span
          v-if="results.length < total"
          class="muted"
        >{{ t('results.showing', { n: results.length }) }}</span>
        <span
          v-if="loading"
          class="muted"
        >{{ t('results.searching') }}</span>
        <span
          v-if="error"
          class="error"
        > · {{ error }}</span>
      </p>
      <label class="perpage">{{ t('results.perPage') }}
        <select v-model.number="f.perPage">
          <option :value="50">50</option>
          <option :value="100">100</option>
          <option :value="200">200</option>
        </select>
      </label>
    </div>

    <ul class="grid">
      <VideoCard
        v-for="r in results"
        :key="r.id"
        :row="r"
      />
    </ul>

    <!-- Infinite-scroll sentinel: observed to prefetch the next page. -->
    <div
      ref="sentinel"
      class="sentinel"
    />
    <p
      v-if="loadingMore"
      class="muted load-more"
    >
      {{ t('results.loadingMore') }}
    </p>
    <p
      v-else-if="!loading && results.length > 0 && results.length >= total"
      class="muted load-more"
    >
      {{ t('results.endOfResults') }}
    </p>

    <p
      v-if="!loading && results.length === 0"
      class="muted empty"
    >
      {{ t('results.noResults') }}
    </p>
  </section>
</template>
