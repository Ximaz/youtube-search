// Reactive state + behaviour for the video-search workspace: the live filter
// form, debounced search, pagination, image-hash filters and comment scanning.
//
// Created once by <SearchWorkspace> via provideVideoSearch(); the filter and
// result components read/mutate the shared state through useSearchContext().
import type { InjectionKey } from 'vue'
import type { ImageMatch, ImageTarget, NumericInput, ResultRow, ScanInfo, SearchResponse } from '~/types/search'

// Single source of truth for the form's initial/reset values, so the two never
// drift apart.
function defaultFilters() {
  return {
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
    images: {
      thumbnail: { phash: '', threshold: 10 },
      avatar: { phash: '', threshold: 10 },
    } as Record<ImageTarget, ImageMatch>,
    commentTexts: '',
    commentMode: 'all' as 'all' | 'any',
    includeUnknownNumeric: true,
    includeDeleted: true,
    sort: 'published_desc',
    perPage: 50,
  }
}

function useVideoSearch() {
  const { t } = useI18n()
  const f = reactive(defaultFilters())

  const imageError = ref<string | null>(null)

  async function hashImage(body: FormData | Record<string, unknown>, target: ImageTarget, failure: string): Promise<void> {
    imageError.value = null
    try {
      const res = await $fetch<{ phash: string }>('/api/image-search', { method: 'POST', body })
      f.images[target].phash = res.phash
    }
    catch {
      imageError.value = failure
    }
  }

  async function hashFromUrl(url: string, target: ImageTarget): Promise<void> {
    if (!url.trim()) return
    await hashImage({ url }, target, t('errors.imageUrl'))
  }

  async function hashFromFile(event: Event, target: ImageTarget): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const form = new FormData()
    form.append('image', file)
    await hashImage(form, target, t('errors.imageFile'))
  }

  // Paste straight into the URL field: if the clipboard holds an image blob we
  // hash it (à la Google/Yandex image search); plain text falls through as a URL.
  async function hashFromPaste(event: ClipboardEvent, target: ImageTarget): Promise<void> {
    const file = Array.from(event.clipboardData?.items ?? [])
      .find(item => item.kind === 'file' && item.type.startsWith('image/'))
      ?.getAsFile()
    if (!file) return
    event.preventDefault()
    const form = new FormData()
    form.append('image', file, file.name || 'clipboard.png')
    await hashImage(form, target, t('errors.imagePaste'))
  }

  function clearImage(target: ImageTarget): void {
    f.images[target].phash = ''
  }

  const scanning = ref(false)
  const scanInfo = ref<ScanInfo | null>(null)

  function parsedCommentTexts(): string[] {
    return f.commentTexts.split('\n').map(s => s.trim()).filter(Boolean)
  }

  async function scanComments(): Promise<void> {
    scanning.value = true
    scanInfo.value = null
    try {
      scanInfo.value = await $fetch<ScanInfo>('/api/comment-scan', { method: 'POST', body: buildSpec() })
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
    if (f.images.thumbnail.phash) spec.thumbnail = { phash: f.images.thumbnail.phash, threshold: f.images.thumbnail.threshold }
    if (f.images.avatar.phash) spec.channelAvatar = { phash: f.images.avatar.phash, threshold: f.images.avatar.threshold }
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
      if (seq === searchSeq) error.value = t('errors.searchFailed')
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

  onMounted(() => {
    void runSearch()
  })
  onBeforeUnmount(() => {
    if (debounce) clearTimeout(debounce)
  })

  function reset(): void {
    const fresh = defaultFilters()
    fresh.perPage = f.perPage // keep the current page size across a reset
    Object.assign(f, fresh)
    scanInfo.value = null
  }

  return {
    f,
    imageError,
    scanning,
    scanInfo,
    results,
    total,
    loading,
    loadingMore,
    error,
    hashFromUrl,
    hashFromFile,
    hashFromPaste,
    clearImage,
    scanComments,
    loadMore,
    reset,
  }
}

export type VideoSearchContext = ReturnType<typeof useVideoSearch>

const VIDEO_SEARCH_KEY = Symbol('video-search') as InjectionKey<VideoSearchContext>

// Called once by <SearchWorkspace>: builds the reactive context and provides it
// to the filter/result component subtree.
export function provideVideoSearch(): VideoSearchContext {
  const ctx = useVideoSearch()
  provide(VIDEO_SEARCH_KEY, ctx)
  return ctx
}

// Read/mutate the shared search state from any descendant component.
export function useSearchContext(): VideoSearchContext {
  const ctx = inject(VIDEO_SEARCH_KEY)
  if (!ctx) throw new Error('useSearchContext() must be used inside <SearchWorkspace>')
  return ctx
}
