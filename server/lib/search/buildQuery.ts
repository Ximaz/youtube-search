import type { SQL } from 'drizzle-orm'
import { and, eq, exists, gte, inArray, isNotNull, isNull, lte, notExists, or, sql } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { channels, playlistItems, playlists, videoComments, videos } from '../../database/schema'
import { useDb } from '../db'
import { normalizeTokens } from '../text/normalize'
import type { FilterSpec, NumericFilter } from './filterSpec'

// Scrambled-word substring match: every typed fragment (normalized) must appear
// as a substring of the normalized text column (diacritic-insensitive,
// trgm-indexed), in any order.
function tokensCondition(normTextColumn: PgColumn, raw: string | undefined): SQL | undefined {
  if (!raw) return undefined
  const tokens = normalizeTokens(raw)
  if (tokens.length === 0) return undefined
  const parts = tokens.map(token => sql`${normTextColumn} ilike ${`%${token}%`}`)
  return and(...parts)
}

function rangeBounds(f: NumericFilter): { lo?: number, hi?: number } {
  if (!f) return {}
  let lo: number | undefined
  let hi: number | undefined
  if (f.value != null) {
    const tol = (f.tolerancePct ?? 0) / 100
    lo = Math.floor(f.value * (1 - tol))
    hi = Math.ceil(f.value * (1 + tol))
  }
  if (f.min != null) lo = lo == null ? f.min : Math.max(lo, f.min)
  if (f.max != null) hi = hi == null ? f.max : Math.min(hi, f.max)
  return { lo, hi }
}

function numericCondition(column: PgColumn, f: NumericFilter, includeUnknown: boolean): SQL | undefined {
  const { lo, hi } = rangeBounds(f)
  const bounds: SQL[] = []
  if (lo != null) bounds.push(gte(column, lo))
  if (hi != null) bounds.push(lte(column, hi))
  if (bounds.length === 0) return undefined
  const inRange = and(...bounds)!
  return includeUnknown ? or(isNull(column), inRange)! : inRange
}

// Subscriber count is rounded down to 3 significant figures: clamp tolerance to
// >= 0.1% and widen the low bound by the rounding granularity. Hidden counts
// are treated as unknown.
function subscriberCondition(f: NumericFilter, includeUnknown: boolean): SQL | undefined {
  if (!f) return undefined
  let lo: number | undefined
  let hi: number | undefined
  if (f.value != null) {
    const tol = Math.max(f.tolerancePct ?? 0, 0.1) / 100
    const granularity = f.value > 0 ? 10 ** (Math.floor(Math.log10(f.value)) - 2) : 0
    lo = Math.floor(f.value * (1 - tol)) - granularity
    hi = Math.ceil(f.value * (1 + tol))
  }
  if (f.min != null) lo = lo == null ? f.min : Math.max(lo, f.min)
  if (f.max != null) hi = hi == null ? f.max : Math.min(hi, f.max)
  const bounds: SQL[] = []
  if (lo != null) bounds.push(gte(channels.subscriberCount, lo))
  if (hi != null) bounds.push(lte(channels.subscriberCount, hi))
  if (bounds.length === 0) return undefined
  const inRange = and(...bounds)!
  return includeUnknown
    ? or(isNull(channels.subscriberCount), eq(channels.subscriberCountHidden, true), inRange)!
    : inRange
}

function dateCondition(p: FilterSpec['published']): SQL | undefined {
  if (!p) return undefined
  const days = p.outOfBoundDays ?? 0
  const bounds: SQL[] = []
  if (p.from) {
    const d = new Date(p.from)
    d.setDate(d.getDate() - days)
    bounds.push(gte(videos.publishedAt, d))
  }
  if (p.to) {
    const d = new Date(p.to)
    d.setDate(d.getDate() + days)
    d.setHours(23, 59, 59, 999)
    bounds.push(lte(videos.publishedAt, d))
  }
  return bounds.length ? and(...bounds) : undefined
}

const SAVED_EXISTS = sql`exists (select 1 from playlist_items pi join playlists p on p.id = pi.playlist_id where pi.video_id = ${videos.id} and p.kind = 'user')`
const SUBSCRIBED_EXISTS = sql`exists (select 1 from subscriptions s where s.channel_id = ${videos.channelId} and s.subscribed)`

function buildConditions(spec: FilterSpec): SQL[] {
  const conditions: SQL[] = [isNotNull(videos.lastFetchedAt)]
  if (!spec.includeDeleted) conditions.push(eq(videos.deletedFromYoutube, false))

  const push = (c: SQL | undefined): void => {
    if (c) conditions.push(c)
  }

  push(tokensCondition(videos.titleNormText, spec.title))
  push(tokensCondition(videos.descriptionNormText, spec.description))
  push(tokensCondition(channels.titleNormText, spec.channelTitle))
  push(dateCondition(spec.published))
  push(numericCondition(videos.viewCount, spec.viewCount, spec.includeUnknownNumeric))
  push(numericCondition(videos.likeCount, spec.likeCount, spec.includeUnknownNumeric))
  push(numericCondition(videos.commentCount, spec.commentCount, spec.includeUnknownNumeric))
  push(subscriberCondition(spec.subscriberCount, spec.includeUnknownNumeric))

  const durCond = numericCondition(videos.durationSeconds, spec.durationSeconds, spec.includeUnknownNumeric)
  if (durCond) push(and(eq(videos.isLiveOrUpcoming, false), durCond))

  if (spec.thumbnail) {
    push(sql`${videos.thumbPhash} is not null and bit_count(${videos.thumbPhash} # ${spec.thumbnail.phash}::bit(64)) <= ${spec.thumbnail.threshold}`)
  }
  if (spec.channelAvatar) {
    push(sql`${channels.avatarPhash} is not null and bit_count(${channels.avatarPhash} # ${spec.channelAvatar.phash}::bit(64)) <= ${spec.channelAvatar.threshold}`)
  }

  if (spec.subscribed !== undefined) {
    push(spec.subscribed ? SUBSCRIBED_EXISTS : sql`not ${SUBSCRIBED_EXISTS}`)
  }
  if (spec.saved) {
    const ids = spec.saved.playlistIds
    const conds: SQL[] = [eq(playlistItems.videoId, videos.id), eq(playlists.kind, 'user')]
    if (ids?.length) conds.push(inArray(playlists.id, ids))
    const sub = useDb()
      .select({ x: sql`1` })
      .from(playlistItems)
      .innerJoin(playlists, eq(playlists.id, playlistItems.playlistId))
      .where(and(...conds))
    push(spec.saved.state ? exists(sub) : notExists(sub))
  }

  if (spec.ownComments) {
    const perText: SQL[] = []
    for (const text of spec.ownComments.texts) {
      const tokens = normalizeTokens(text)
      if (tokens.length === 0) continue
      const conds: SQL[] = [eq(videoComments.videoId, videos.id)]
      for (const token of tokens) conds.push(sql`${videoComments.textNormText} ilike ${`%${token}%`}`)
      perText.push(exists(useDb().select({ x: sql`1` }).from(videoComments).where(and(...conds))))
    }
    if (perText.length > 0) {
      const combined = spec.ownComments.mode === 'all' ? and(...perText) : or(...perText)
      if (combined) push(combined)
    }
  }
  return conditions
}

function orderExpr(sort: FilterSpec['sort']): SQL {
  switch (sort) {
    case 'published_asc': return sql`${videos.publishedAt} asc nulls last`
    case 'views_desc': return sql`${videos.viewCount} desc nulls last`
    case 'likes_desc': return sql`${videos.likeCount} desc nulls last`
    case 'duration_desc': return sql`${videos.durationSeconds} desc nulls last`
    case 'duration_asc': return sql`${videos.durationSeconds} asc nulls last`
    default: return sql`${videos.publishedAt} desc nulls last`
  }
}

export interface SearchResultRow {
  id: string
  title: string
  channelId: string | null
  channelTitle: string | null
  publishedAt: Date | null
  durationSeconds: number | null
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  isLiveOrUpcoming: boolean
  deletedFromYoutube: boolean
  thumbS3Key: string | null
  saved: boolean
  subscribed: boolean
}

export async function searchVideos(spec: FilterSpec): Promise<{ total: number, results: SearchResultRow[] }> {
  const db = useDb()
  const conditions = buildConditions(spec)
  const where = and(...conditions)

  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      channelId: videos.channelId,
      channelTitle: channels.title,
      publishedAt: videos.publishedAt,
      durationSeconds: videos.durationSeconds,
      viewCount: videos.viewCount,
      likeCount: videos.likeCount,
      commentCount: videos.commentCount,
      isLiveOrUpcoming: videos.isLiveOrUpcoming,
      deletedFromYoutube: videos.deletedFromYoutube,
      thumbS3Key: videos.thumbS3Key,
      saved: sql<boolean>`${SAVED_EXISTS}`,
      subscribed: sql<boolean>`${SUBSCRIBED_EXISTS}`,
    })
    .from(videos)
    .leftJoin(channels, eq(channels.id, videos.channelId))
    .where(where)
    .orderBy(orderExpr(spec.sort))
    .limit(spec.limit)
    .offset(spec.offset)

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(videos)
    .leftJoin(channels, eq(channels.id, videos.channelId))
    .where(where)

  return { total: countRow?.total ?? 0, results: rows }
}
