<script setup lang="ts">
interface NumericInput { value: string, tolerancePct: string }
interface ResultRow {
  id: string
  title: string
  channelTitle: string | null
  publishedAt: string | null
  durationSeconds: number | null
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  deletedFromYoutube: boolean
  saved: boolean
  subscribed: boolean
  isShort: boolean | null
  thumbS3Key: string | null
}
interface SearchResponse { total: number, results: ResultRow[] }

const f = reactive({
  title: '',
  description: '',
  channelTitle: '',
  from: '',
  to: '',
  outOfBoundDays: '',
  views: { value: '', tolerancePct: '' } as NumericInput,
  likes: { value: '', tolerancePct: '' } as NumericInput,
  comments: { value: '', tolerancePct: '' } as NumericInput,
  subscribers: { value: '', tolerancePct: '' } as NumericInput,
  duration: '', // HH:MM:SS
  durationTolerancePct: '',
  subscribed: '' as '' | 'yes' | 'no',
  saved: '' as '' | 'yes' | 'no',
  videoKind: 'any' as 'any' | 'short' | 'video',
  thumbnailPhash: '',
  thumbnailThreshold: 10,
  avatarPhash: '',
  avatarThreshold: 10,
  commentTexts: '',
  commentMode: 'all' as 'all' | 'any',
  includeUnknownNumeric: true,
  includeDeleted: true,
  sort: 'published_desc',
  perPage: 50,
})

const imageError = ref<string | null>(null)

async function hashFromUrl(url: string, target: 'thumbnail' | 'avatar'): Promise<void> {
  if (!url.trim()) return
  imageError.value = null
  try {
    const res = await $fetch<{ phash: string }>('/api/image-search', { method: 'POST', body: { url } })
    if (target === 'thumbnail') f.thumbnailPhash = res.phash
    else f.avatarPhash = res.phash
  }
  catch {
    imageError.value = 'Could not read that image URL.'
  }
}

async function hashFromFile(event: Event, target: 'thumbnail' | 'avatar'): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  imageError.value = null
  try {
    const form = new FormData()
    form.append('image', file)
    const res = await $fetch<{ phash: string }>('/api/image-search', { method: 'POST', body: form })
    if (target === 'thumbnail') f.thumbnailPhash = res.phash
    else f.avatarPhash = res.phash
  }
  catch {
    imageError.value = 'Could not read that image file.'
  }
}

// Paste straight into the URL field: if the clipboard holds an image blob we
// hash it (à la Google/Yandex image search); plain text falls through as a URL.
async function hashFromPaste(event: ClipboardEvent, target: 'thumbnail' | 'avatar'): Promise<void> {
  const file = Array.from(event.clipboardData?.items ?? [])
    .find(item => item.kind === 'file' && item.type.startsWith('image/'))
    ?.getAsFile()
  if (!file) return
  event.preventDefault()
  imageError.value = null
  try {
    const form = new FormData()
    form.append('image', file, file.name || 'clipboard.png')
    const res = await $fetch<{ phash: string }>('/api/image-search', { method: 'POST', body: form })
    if (target === 'thumbnail') f.thumbnailPhash = res.phash
    else f.avatarPhash = res.phash
  }
  catch {
    imageError.value = 'Could not read that pasted image.'
  }
}

function clearImage(target: 'thumbnail' | 'avatar'): void {
  if (target === 'thumbnail') f.thumbnailPhash = ''
  else f.avatarPhash = ''
}

const scanning = ref(false)
const scanInfo = ref<{ scanned: number, found: number, remaining: number, parked: boolean } | null>(null)

function parsedCommentTexts(): string[] {
  return f.commentTexts.split('\n').map(s => s.trim()).filter(Boolean)
}

async function scanComments(): Promise<void> {
  scanning.value = true
  scanInfo.value = null
  try {
    scanInfo.value = await $fetch('/api/comment-scan', { method: 'POST', body: buildSpec() })
    await runSearch()
  }
  catch {
    scanInfo.value = null
  }
  finally {
    scanning.value = false
  }
}

const results = ref<ResultRow[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const sentinel = ref<HTMLElement | null>(null)

function hmsToSeconds(input: string): number | null {
  const t = input.trim()
  if (!t) return null
  const parts = t.split(':').map(p => p.trim())
  if (parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  if (nums.slice(1).some(v => v >= 60)) return null
  return nums.reduce((acc, v) => acc * 60 + v, 0)
}

function numeric(n: NumericInput) {
  const value = n.value.trim() === '' ? undefined : Number(n.value)
  const tolerancePct = n.tolerancePct.trim() === '' ? undefined : Number(n.tolerancePct)
  if (value === undefined) return undefined
  return { value, tolerancePct }
}

function buildSpec(offset = 0): Record<string, unknown> {
  const spec: Record<string, unknown> = {
    includeUnknownNumeric: f.includeUnknownNumeric,
    includeDeleted: f.includeDeleted,
    sort: f.sort,
    limit: f.perPage,
    offset,
  }
  if (f.title.trim()) spec.title = f.title
  if (f.description.trim()) spec.description = f.description
  if (f.channelTitle.trim()) spec.channelTitle = f.channelTitle

  if (f.from || f.to) {
    spec.published = {
      ...(f.from ? { from: new Date(f.from).toISOString() } : {}),
      ...(f.to ? { to: new Date(f.to).toISOString() } : {}),
      ...(f.outOfBoundDays ? { outOfBoundDays: Number(f.outOfBoundDays) } : {}),
    }
  }
  const assign = (key: string, input: NumericInput): void => {
    const parsed = numeric(input)
    if (parsed) spec[key] = parsed
  }
  assign('viewCount', f.views)
  assign('likeCount', f.likes)
  assign('commentCount', f.comments)
  assign('subscriberCount', f.subscribers)

  const durSecs = hmsToSeconds(f.duration)
  if (durSecs !== null) {
    spec.durationSeconds = {
      value: durSecs,
      ...(f.durationTolerancePct ? { tolerancePct: Number(f.durationTolerancePct) } : {}),
    }
  }
  if (f.subscribed) spec.subscribed = f.subscribed === 'yes'
  if (f.saved) spec.saved = { state: f.saved === 'yes' }
  if (f.videoKind !== 'any') spec.videoKind = f.videoKind
  if (f.thumbnailPhash) spec.thumbnail = { phash: f.thumbnailPhash, threshold: f.thumbnailThreshold }
  if (f.avatarPhash) spec.channelAvatar = { phash: f.avatarPhash, threshold: f.avatarThreshold }
  const comments = parsedCommentTexts()
  if (comments.length) spec.ownComments = { texts: comments, mode: f.commentMode }
  return spec
}

// A monotonically-increasing tag: a fresh search (reset) bumps it so any
// in-flight reset OR append from an older query is discarded.
let searchSeq = 0

async function runSearch(): Promise<void> {
  const seq = ++searchSeq
  loading.value = true
  error.value = null
  try {
    const res = await $fetch<SearchResponse>('/api/search', { method: 'POST', body: buildSpec(0) })
    if (seq !== searchSeq) return // a newer search superseded this one
    results.value = res.results
    total.value = res.total
  }
  catch {
    if (seq === searchSeq) error.value = 'Search failed.'
  }
  finally {
    if (seq === searchSeq) loading.value = false
  }
}

// Append the next page (infinite scroll), unless we already have everything.
async function loadMore(): Promise<void> {
  if (loading.value || loadingMore.value || results.value.length >= total.value) return
  const seq = searchSeq
  loadingMore.value = true
  try {
    const res = await $fetch<SearchResponse>('/api/search', { method: 'POST', body: buildSpec(results.value.length) })
    if (seq !== searchSeq) return // a new search replaced these results
    results.value.push(...res.results)
    total.value = res.total
  }
  catch {
    // transient; scrolling again retries
  }
  finally {
    loadingMore.value = false
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null
watch(f, () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(runSearch, 350)
}, { deep: true })

let observer: IntersectionObserver | null = null
onMounted(() => {
  void runSearch()
  // Prefetch the next page ~600px before the sentinel reaches the viewport.
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) void loadMore()
  }, { rootMargin: '600px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (debounce) clearTimeout(debounce)
})

function reset(): void {
  Object.assign(f, {
    title: '', description: '', channelTitle: '', from: '', to: '', outOfBoundDays: '',
    views: { value: '', tolerancePct: '' }, likes: { value: '', tolerancePct: '' },
    comments: { value: '', tolerancePct: '' }, subscribers: { value: '', tolerancePct: '' },
    duration: '', durationTolerancePct: '', subscribed: '', saved: '', videoKind: 'any',
    thumbnailPhash: '', thumbnailThreshold: 10, avatarPhash: '', avatarThreshold: 10,
    commentTexts: '', commentMode: 'all',
    includeUnknownNumeric: true, includeDeleted: true, sort: 'published_desc',
  })
  scanInfo.value = null
}

const nf = new Intl.NumberFormat()
function fmtCount(n: number | null): string {
  return n == null ? '—' : nf.format(n)
}
function fmtDuration(secs: number | null): string {
  if (secs == null) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (v: number) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : '—'
}
function thumb(row: ResultRow): string {
  // Prefer the cached S3 copy (survives YouTube deletion); else live thumbnail.
  return row.thumbS3Key ? `/api/image/${row.thumbS3Key}` : `https://i.ytimg.com/vi/${row.id}/mqdefault.jpg`
}
</script>

<template>
  <div class="workspace">
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

      <details
        class="cat"
        open
      >
        <summary>Search text</summary>
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
      </details>

      <details class="cat">
        <summary>Date published</summary>
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
      </details>

      <details class="cat">
        <summary>Counts &amp; duration <small>(value + tolerance %)</small></summary>
        <div class="numrow">
          <span>Views</span>
          <input
            v-model="f.views.value"
            type="number"
            min="0"
            placeholder="value"
          >
          <input
            v-model="f.views.tolerancePct"
            type="number"
            min="0"
            max="100"
            placeholder="± %"
          >
        </div>
        <div class="numrow">
          <span>Likes</span>
          <input
            v-model="f.likes.value"
            type="number"
            min="0"
            placeholder="value"
          >
          <input
            v-model="f.likes.tolerancePct"
            type="number"
            min="0"
            max="100"
            placeholder="± %"
          >
        </div>
        <div class="numrow">
          <span>Comments</span>
          <input
            v-model="f.comments.value"
            type="number"
            min="0"
            placeholder="value"
          >
          <input
            v-model="f.comments.tolerancePct"
            type="number"
            min="0"
            max="100"
            placeholder="± %"
          >
        </div>
        <div class="numrow">
          <span>Subscribers</span>
          <input
            v-model="f.subscribers.value"
            type="number"
            min="0"
            placeholder="value"
          >
          <input
            v-model="f.subscribers.tolerancePct"
            type="number"
            min="0"
            max="100"
            placeholder="± %"
          >
        </div>
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
      </details>

      <details class="cat">
        <summary>Match by image <small>(perceptual hash)</small></summary>
        <div class="imgfilter">
          <span class="imglabel">Thumbnail</span>
          <template v-if="!f.thumbnailPhash">
            <input
              type="url"
              placeholder="paste image or type URL"
              @paste="hashFromPaste($event, 'thumbnail')"
              @change="hashFromUrl(($event.target as HTMLInputElement).value, 'thumbnail')"
            >
            <input
              type="file"
              accept="image/*"
              @change="hashFromFile($event, 'thumbnail')"
            >
          </template>
          <template v-else>
            <span class="imgok">✓ image set</span>
            <label class="slider">strictness
              <input
                v-model.number="f.thumbnailThreshold"
                type="range"
                min="0"
                max="30"
              >
              <span>{{ f.thumbnailThreshold }}</span>
            </label>
            <button
              class="link"
              @click="clearImage('thumbnail')"
            >
              Clear
            </button>
          </template>
        </div>
        <div class="imgfilter">
          <span class="imglabel">Channel avatar</span>
          <template v-if="!f.avatarPhash">
            <input
              type="url"
              placeholder="paste image or type URL"
              @paste="hashFromPaste($event, 'avatar')"
              @change="hashFromUrl(($event.target as HTMLInputElement).value, 'avatar')"
            >
            <input
              type="file"
              accept="image/*"
              @change="hashFromFile($event, 'avatar')"
            >
          </template>
          <template v-else>
            <span class="imgok">✓ image set</span>
            <label class="slider">strictness
              <input
                v-model.number="f.avatarThreshold"
                type="range"
                min="0"
                max="30"
              >
              <span>{{ f.avatarThreshold }}</span>
            </label>
            <button
              class="link"
              @click="clearImage('avatar')"
            >
              Clear
            </button>
          </template>
        </div>
        <p
          v-if="imageError"
          class="error"
        >
          {{ imageError }}
        </p>
      </details>

      <details class="cat">
        <summary>My comments</summary>
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
      </details>

      <details
        class="cat"
        open
      >
        <summary>Flags</summary>
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
      </details>

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

    <section class="results">
      <div class="results-head">
        <p>
          <strong>{{ total }}</strong> match{{ total === 1 ? '' : 'es' }}
          <span
            v-if="results.length < total"
            class="muted"
          > · showing {{ results.length }}</span>
          <span
            v-if="loading"
            class="muted"
          > · searching…</span>
          <span
            v-if="error"
            class="error"
          > · {{ error }}</span>
        </p>
        <label class="perpage">Per page
          <select v-model.number="f.perPage">
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </label>
      </div>

      <ul class="grid">
        <li
          v-for="r in results"
          :key="r.id"
          class="vcard"
        >
          <a
            :href="`https://www.youtube.com/watch?v=${r.id}`"
            target="_blank"
            rel="noopener"
            class="thumb"
          >
            <img
              :src="thumb(r)"
              loading="lazy"
              alt=""
            >
            <span
              v-if="r.durationSeconds"
              class="dur"
            >{{ fmtDuration(r.durationSeconds) }}</span>
          </a>
          <div class="vbody">
            <a
              :href="`https://www.youtube.com/watch?v=${r.id}`"
              target="_blank"
              rel="noopener"
              class="vtitle"
            >{{ r.title || '(untitled)' }}</a>
            <div class="vchannel">
              {{ r.channelTitle || '—' }}
            </div>
            <div class="vmeta">
              {{ fmtCount(r.viewCount) }} views · {{ fmtCount(r.likeCount) }} likes · {{ fmtDate(r.publishedAt) }}
            </div>
            <div class="badges">
              <span
                v-if="r.isShort"
                class="badge short"
              >short</span>
              <span
                v-if="r.saved"
                class="badge saved"
              >saved</span>
              <span
                v-if="r.subscribed"
                class="badge sub"
              >subscribed</span>
              <span
                v-if="r.deletedFromYoutube"
                class="badge del"
              >deleted</span>
            </div>
          </div>
        </li>
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
        Loading more…
      </p>
      <p
        v-else-if="!loading && results.length > 0 && results.length >= total"
        class="muted load-more"
      >
        End of results.
      </p>

      <p
        v-if="!loading && results.length === 0"
        class="muted empty"
      >
        No videos match these filters.
      </p>
    </section>
  </div>
</template>

<style scoped>
.workspace { display: grid; grid-template-columns: 320px 1fr; gap: 1.25rem; align-items: start; }
.filters { background: #fff; border: 1px solid #e5e5ea; border-radius: 12px; padding: 1rem; position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; }
.filters-head { display: flex; justify-content: space-between; align-items: center; }
.filters h2 { margin: 0; font-size: 1rem; }
.filters label { display: block; font-size: .8rem; color: #444; margin-top: .7rem; }
.filters small { color: #999; font-weight: 400; }
.filters input, .filters select { width: 100%; margin-top: .2rem; padding: .4rem .5rem; border: 1px solid #d0d0d5; border-radius: 7px; font-size: .9rem; box-sizing: border-box; }
.cat { border: 1px solid #eee; border-radius: 9px; margin-top: .6rem; padding: 0 .7rem; }
.cat[open] { padding-bottom: .6rem; }
.cat > summary { cursor: pointer; padding: .55rem .1rem; font-size: .8rem; font-weight: 600; color: #555; }
.cat > summary:hover { color: #1c1c1e; }
.cat > summary small { font-weight: 400; color: #999; }
.cat[open] > summary { border-bottom: 1px solid #f0f0f0; margin-bottom: .2rem; }
.numrow { display: grid; grid-template-columns: 78px 1fr 64px; gap: .4rem; align-items: center; margin-top: .4rem; font-size: .8rem; }
.numrow input { margin-top: 0; }
.check { display: flex; gap: .4rem; align-items: flex-start; margin-top: .6rem; }
.check input { width: auto; margin-top: .15rem; }
.imgfilter { margin-top: .5rem; font-size: .8rem; }
.imglabel { display: block; color: #444; margin-bottom: .2rem; }
.filters textarea { width: 100%; box-sizing: border-box; margin-top: .3rem; padding: .4rem .5rem; border: 1px solid #d0d0d5; border-radius: 7px; font: inherit; font-size: .85rem; resize: vertical; }
.hint { font-size: .72rem; margin: .2rem 0; }
.imgok { color: #1a7f37; margin-right: .5rem; }
.slider { display: flex; align-items: center; gap: .4rem; margin-top: .3rem; }
.slider input[type="range"] { flex: 1; }
.results-head { margin: 0 0 .8rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.results-head p { margin: 0; }
.perpage { font-size: .8rem; color: #444; white-space: nowrap; }
.perpage select { margin-left: .3rem; padding: .25rem .4rem; border: 1px solid #d0d0d5; border-radius: 7px; font-size: .85rem; }
.sentinel { height: 1px; }
.load-more { text-align: center; margin: 1rem 0; font-size: .85rem; }
.grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1rem; }
.vcard { background: #fff; border: 1px solid #e5e5ea; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
.thumb { position: relative; display: block; aspect-ratio: 16/9; background: #f2f2f7; }
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dur { position: absolute; right: 6px; bottom: 6px; background: rgba(0,0,0,.8); color: #fff; font-size: .72rem; padding: .05rem .3rem; border-radius: 4px; }
.vbody { padding: .6rem .7rem; }
.vtitle { font-weight: 600; font-size: .9rem; color: #1c1c1e; text-decoration: none; display: block; line-height: 1.25; }
.vtitle:hover { color: #cc0000; }
.vchannel { color: #555; font-size: .82rem; margin-top: .2rem; }
.vmeta { color: #888; font-size: .76rem; margin-top: .3rem; }
.badges { margin-top: .45rem; display: flex; gap: .3rem; flex-wrap: wrap; }
.badge { font-size: .68rem; padding: .08rem .4rem; border-radius: 999px; }
.badge.short { background: #fdeef0; color: #cc0000; }
.badge.saved { background: #e7f5ec; color: #1a7f37; }
.badge.sub { background: #e8eefc; color: #2952cc; }
.badge.del { background: #fde8e8; color: #cc0000; }
.muted { color: #6b6b70; }
.error { color: #cc0000; }
.empty { margin-top: 2rem; text-align: center; }
</style>
