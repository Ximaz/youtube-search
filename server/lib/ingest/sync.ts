import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import { channels, imageBlobs, oauthAccount, playlistItems, playlists, subscriptions, syncState, videos } from '../../database/schema'
import { useCache } from '../cache'
import { useEnv } from '../env'
import type { StoredImage } from '../image/store'
import { processImageUrl, processVideoThumbnail } from '../image/store'
import { useDb } from '../db'
import { normalizeTokens } from '../text/normalize'
import {
  getChannelsBatch,
  getMyChannel,
  getVideosBatch,
  listMyPlaylistsPage,
  listMySubscriptionsPage,
  listPlaylistItemsPage,
} from '../youtube/api'
import { QuotaParkedError } from '../youtube/errors'
import { getValidAccessToken } from '../youtube/oauth'
import { callWithQuota } from '../youtube/quota'

const LOCK_KEY = 'yt:lock:sync'
const LOCK_TTL = 300
const SUB_RUN_KEY = 'yt:sync:subRunAt'
const HYDRATE_BATCH = 50
export const SYNC_QUEUE_KEY = 'yt:sync:queue'

export type SyncPhase
  = | 'idle' | 'me' | 'playlists' | 'playlist_items'
    | 'hydrate_videos' | 'hydrate_channels' | 'subscriptions' | 'images' | 'done'

export interface SyncResult {
  outcome: 'done' | 'parked' | 'locked' | 'not_connected'
  phase: SyncPhase
  parkedSeconds?: number
}

// Runs the ingestion state machine to completion (or until quota-parked).
// Resumable: all progress lives in the sync_state row + the entity tables.
export async function runSync(): Promise<SyncResult> {
  const cache = useCache()
  const acquired = await cache.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX')
  if (!acquired) return { outcome: 'locked', phase: 'idle' }

  try {
    let state = await loadOrInitState()
    // First-ever run starts a sync; a completed sync stays done until a fresh
    // one is requested (so periodic ticks only RESUME in-progress work).
    if (state.phase === 'idle') state = await setPhase('me')
    if (state.phase === 'done') return { outcome: 'done', phase: 'done' }

    for (let guard = 0; guard < 1_000_000; guard++) {
      if (state.phase === 'done') return { outcome: 'done', phase: 'done' }
      await cache.expire(LOCK_KEY, LOCK_TTL)
      try {
        state = await step(state.phase as SyncPhase)
      }
      catch (error) {
        if (error instanceof QuotaParkedError) {
          await setError(`quota exhausted; resuming in ~${error.resumeInSeconds}s`)
          return { outcome: 'parked', phase: state.phase as SyncPhase, parkedSeconds: error.resumeInSeconds }
        }
        throw error
      }
    }
    return { outcome: 'done', phase: state.phase as SyncPhase }
  }
  finally {
    await cache.del(LOCK_KEY)
  }
}

type State = typeof syncState.$inferSelect

async function step(phase: SyncPhase): Promise<State> {
  switch (phase) {
    case 'me': return stepMe()
    case 'playlists': return stepPlaylists()
    case 'playlist_items': return stepPlaylistItems()
    case 'hydrate_videos': return stepHydrateVideos()
    case 'hydrate_channels': return stepHydrateChannels()
    case 'subscriptions': return stepSubscriptions()
    case 'images': return stepImages()
    default: return setPhase('done')
  }
}

// --- me: own channel + likes playlist row ---
async function stepMe(): Promise<State> {
  const token = await getValidAccessToken()
  const channel = await callWithQuota(() => getMyChannel(token))
  const db = useDb()
  const now = new Date()
  if (channel) {
    await db.insert(channels)
      .values({ id: channel.id, title: channel.title, titleNorm: normalizeTokens(channel.title) })
      .onConflictDoUpdate({ target: channels.id, set: { title: channel.title, titleNorm: normalizeTokens(channel.title), updatedAt: now } })
    await db.update(oauthAccount).set({ ownChannelId: channel.id, updatedAt: now }).where(eq(oauthAccount.id, 1))
    if (channel.likesPlaylistId) {
      await db.insert(playlists)
        .values({ id: channel.likesPlaylistId, title: 'Liked videos', kind: 'likes' })
        .onConflictDoUpdate({ target: playlists.id, set: { kind: 'likes', updatedAt: now } })
    }
  }
  return setPhase('playlists')
}

// --- playlists: enumerate the user's own playlists ---
async function stepPlaylists(): Promise<State> {
  const state = await getState()
  const page = await listMyPlaylistsPage(state.pageToken ?? undefined)
  const db = useDb()
  const now = new Date()
  for (const p of page.items) {
    await db.insert(playlists)
      .values({ id: p.id, title: p.title, kind: 'user', privacyStatus: p.privacyStatus, itemCount: p.itemCount })
      .onConflictDoUpdate({ target: playlists.id, set: { title: p.title, privacyStatus: p.privacyStatus, itemCount: p.itemCount, updatedAt: now } })
  }
  if (page.nextPageToken) return setCursor({ pageToken: page.nextPageToken })
  return setPhase('playlist_items', { currentPlaylistId: '', pageToken: null })
}

// --- playlist_items: page every playlist, recording membership + video stubs ---
async function stepPlaylistItems(): Promise<State> {
  const state = await getState()
  const db = useDb()
  const currentId = state.currentPlaylistId ?? ''

  // Pick the playlist to work on (resume current, else the next one by id).
  let playlistId = currentId
  if (!playlistId) {
    const [next] = await db.select({ id: playlists.id }).from(playlists).where(gt(playlists.id, currentId)).orderBy(asc(playlists.id)).limit(1)
    if (!next) return setPhase('hydrate_videos', { currentPlaylistId: null, pageToken: null })
    playlistId = next.id
  }

  const page = await listPlaylistItemsPage(playlistId, state.pageToken ?? undefined)
  if (page.items.length > 0) {
    const ids = [...new Set(page.items.map(i => i.videoId))]
    await db.insert(videos).values(ids.map(id => ({ id, title: '' }))).onConflictDoNothing()
    await db.insert(playlistItems)
      .values(page.items.map(i => ({
        playlistId,
        videoId: i.videoId,
        position: i.position,
        addedAt: i.addedAt ? new Date(i.addedAt) : null,
        playlistItemId: i.playlistItemId,
      })))
      .onConflictDoUpdate({
        target: [playlistItems.playlistId, playlistItems.videoId],
        set: { position: sqlExcluded('position'), addedAt: sqlExcluded('added_at'), playlistItemId: sqlExcluded('playlist_item_id') },
      })
  }

  if (page.nextPageToken) return setCursor({ currentPlaylistId: playlistId, pageToken: page.nextPageToken })

  // This playlist is done — advance to the next one (or the next phase).
  const [next] = await db.select({ id: playlists.id }).from(playlists).where(gt(playlists.id, playlistId)).orderBy(asc(playlists.id)).limit(1)
  if (next) return setCursor({ currentPlaylistId: next.id, pageToken: null })
  return setPhase('hydrate_videos', { currentPlaylistId: null, pageToken: null })
}

// --- hydrate_videos: fill stub videos (50/call); flag vanished ids as deleted ---
async function stepHydrateVideos(): Promise<State> {
  const db = useDb()
  const now = new Date()
  // Stub videos (never fetched) + previously-hydrated videos whose mutable stats
  // have gone stale (incremental re-sync). Known-deleted videos are left alone.
  const staleBefore = new Date(now.getTime() - useEnv().RESYNC_STALE_AFTER_DAYS * 86_400_000)
  const rows = await db.select({ id: videos.id }).from(videos)
    .where(and(eq(videos.deletedFromYoutube, false), or(isNull(videos.lastFetchedAt), lt(videos.lastFetchedAt, staleBefore))))
    .limit(HYDRATE_BATCH)
  if (rows.length === 0) {
    // subscriptions runs BEFORE hydrate_channels so newly-subscribed channels
    // are hydrated (title + avatar) in this same run, not left blank.
    await useCache().set(SUB_RUN_KEY, now.toISOString())
    return setPhase('subscriptions', { pageToken: null })
  }

  const ids = rows.map(r => r.id)
  const fetched = await getVideosBatch(ids)

  const channelIds = [...new Set(fetched.map(v => v.channelId).filter((c): c is string => Boolean(c)))]
  if (channelIds.length > 0) {
    await db.insert(channels).values(channelIds.map(id => ({ id, title: '' }))).onConflictDoNothing()
  }

  for (const v of fetched) {
    await db.update(videos).set({
      channelId: v.channelId,
      title: v.title,
      titleNorm: normalizeTokens(v.title),
      description: v.description,
      descriptionNorm: v.description ? normalizeTokens(v.description) : [],
      publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
      durationSeconds: v.durationSeconds,
      isLiveOrUpcoming: v.isLiveOrUpcoming,
      viewCount: v.viewCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      statsHidden: v.statsHidden,
      deletedFromYoutube: false,
      lastFetchedAt: now,
      updatedAt: now,
    }).where(eq(videos.id, v.id))
  }

  const returned = new Set(fetched.map(v => v.id))
  const missing = ids.filter(id => !returned.has(id))
  if (missing.length > 0) {
    await db.update(videos).set({ deletedFromYoutube: true, lastFetchedAt: now, updatedAt: now }).where(inArray(videos.id, missing))
  }
  return getState()
}

// --- hydrate_channels: fill stub channels (50/call) ---
async function stepHydrateChannels(): Promise<State> {
  const db = useDb()
  const now = new Date()
  const staleBefore = new Date(now.getTime() - useEnv().RESYNC_STALE_AFTER_DAYS * 86_400_000)
  const rows = await db.select({ id: channels.id }).from(channels)
    .where(or(isNull(channels.lastFetchedAt), lt(channels.lastFetchedAt, staleBefore)))
    .limit(HYDRATE_BATCH)
  if (rows.length === 0) return setPhase('images')

  const ids = rows.map(r => r.id)
  const fetched = await getChannelsBatch(ids)
  for (const c of fetched) {
    await db.update(channels).set({
      title: c.title,
      titleNorm: normalizeTokens(c.title),
      description: c.description,
      subscriberCount: c.subscriberCount,
      subscriberCountHidden: c.hiddenSubscriberCount,
      videoCount: c.videoCount,
      viewCount: c.viewCount,
      lastFetchedAt: now,
      updatedAt: now,
    }).where(eq(channels.id, c.id))
  }
  const returned = new Set(fetched.map(c => c.id))
  const missing = ids.filter(id => !returned.has(id))
  if (missing.length > 0) {
    await db.update(channels).set({ lastFetchedAt: now, updatedAt: now }).where(inArray(channels.id, missing))
  }
  return getState()
}

// --- subscriptions: page-all + reconcile vanished subs ---
async function stepSubscriptions(): Promise<State> {
  const state = await getState()
  const db = useDb()
  const now = new Date()
  const page = await listMySubscriptionsPage(state.pageToken ?? undefined)

  if (page.items.length > 0) {
    await db.insert(channels).values(page.items.map(id => ({ id, title: '' }))).onConflictDoNothing()
    for (const channelId of page.items) {
      await db.insert(subscriptions).values({ channelId, subscribed: true, lastSeenAt: now })
        .onConflictDoUpdate({ target: subscriptions.channelId, set: { subscribed: true, lastSeenAt: now } })
    }
  }

  if (page.nextPageToken) return setCursor({ pageToken: page.nextPageToken })

  // Reconcile: anything not seen since this subscriptions run is unsubscribed.
  const runAt = await useCache().get(SUB_RUN_KEY)
  if (runAt) {
    await db.update(subscriptions).set({ subscribed: false }).where(lt(subscriptions.lastSeenAt, new Date(runAt)))
  }
  return setPhase('hydrate_channels', { pageToken: null })
}

const IMAGE_BATCH = 24
const IMAGE_CONCURRENCY = 8

async function mapLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn))
  }
}

async function upsertImageBlob(entityType: string, entityId: string, stored: StoredImage, sourceUrl: string): Promise<void> {
  await useDb().insert(imageBlobs)
    .values({ s3Key: stored.s3Key, entityType, entityId, resolution: stored.resolution, sourceUrl, phash: stored.phash, contentType: 'image/jpeg' })
    .onConflictDoUpdate({ target: imageBlobs.s3Key, set: { phash: stored.phash, resolution: stored.resolution, fetchedAt: new Date() } })
}

// --- images: fetch best-res thumbnails (no quota) + channel avatars (re-fetch),
// hash them, and store to S3. thumb_s3_key/avatar_s3_key='' is a "tried, none"
// sentinel so failures aren't retried forever. ---
async function stepImages(): Promise<State> {
  const db = useDb()
  const now = new Date()

  const videoRows = await db.select({ id: videos.id }).from(videos)
    .where(and(isNull(videos.thumbS3Key), eq(videos.deletedFromYoutube, false), isNotNull(videos.lastFetchedAt)))
    .limit(IMAGE_BATCH)
  if (videoRows.length > 0) {
    await mapLimited(videoRows, IMAGE_CONCURRENCY, async (row) => {
      const stored = await processVideoThumbnail(row.id)
      if (stored) {
        await db.update(videos).set({ thumbPhash: stored.phash, thumbS3Key: stored.s3Key, thumbSourceRes: stored.resolution, updatedAt: now }).where(eq(videos.id, row.id))
        await upsertImageBlob('video_thumb', row.id, stored, `https://i.ytimg.com/vi/${row.id}/${stored.resolution}`)
      }
      else {
        await db.update(videos).set({ thumbS3Key: '', updatedAt: now }).where(eq(videos.id, row.id))
      }
    })
    return getState()
  }

  const channelRows = await db.select({ id: channels.id }).from(channels)
    .where(and(isNull(channels.avatarS3Key), isNotNull(channels.lastFetchedAt)))
    .limit(50)
  if (channelRows.length > 0) {
    const fetched = await getChannelsBatch(channelRows.map(r => r.id))
    const byId = new Map(fetched.map(c => [c.id, c]))
    await mapLimited(channelRows, IMAGE_CONCURRENCY, async (row) => {
      const channel = byId.get(row.id)
      const url = channel?.thumbnails.high?.url ?? channel?.thumbnails.medium?.url ?? channel?.thumbnails.default?.url
      const stored = url ? await processImageUrl(url, `avatars/${row.id}.jpg`) : null
      if (stored && url) {
        await db.update(channels).set({ avatarPhash: stored.phash, avatarS3Key: stored.s3Key, avatarSourceRes: 'high', updatedAt: now }).where(eq(channels.id, row.id))
        await upsertImageBlob('channel_avatar', row.id, stored, url)
      }
      else {
        await db.update(channels).set({ avatarS3Key: '', updatedAt: now }).where(eq(channels.id, row.id))
      }
    })
    return getState()
  }

  await db.update(syncState).set({ lastFullSyncAt: now, lastError: null, updatedAt: now }).where(eq(syncState.id, 1))
  return setPhase('done', { pageToken: null })
}

// Reset to a fresh full sync and wake the worker.
export async function requestFullSync(): Promise<void> {
  const now = new Date()
  await useDb().insert(syncState)
    .values({ id: 1, phase: 'me' })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { phase: 'me', currentPlaylistId: null, pageToken: null, lastError: null, updatedAt: now },
    })
  await useCache().rpush(SYNC_QUEUE_KEY, '1')
}

// ---------- sync_state helpers ----------
async function loadOrInitState(): Promise<State> {
  const db = useDb()
  await db.insert(syncState).values({ id: 1 }).onConflictDoNothing()
  return getState()
}

async function getState(): Promise<State> {
  const [row] = await useDb().select().from(syncState).where(eq(syncState.id, 1)).limit(1)
  if (!row) throw new Error('sync_state row is missing')
  return row
}

async function setPhase(phase: SyncPhase, extra: Partial<State> = {}): Promise<State> {
  const [row] = await useDb().update(syncState)
    .set({ phase, updatedAt: new Date(), ...extra })
    .where(eq(syncState.id, 1))
    .returning()
  if (!row) throw new Error('sync_state row is missing')
  return row
}

async function setCursor(cursor: Partial<State>): Promise<State> {
  const [row] = await useDb().update(syncState)
    .set({ ...cursor, updatedAt: new Date() })
    .where(eq(syncState.id, 1))
    .returning()
  if (!row) throw new Error('sync_state row is missing')
  return row
}

async function setError(message: string): Promise<void> {
  await useDb().update(syncState).set({ lastError: message, updatedAt: new Date() }).where(eq(syncState.id, 1))
}

// `EXCLUDED.<col>` reference for upsert SET clauses.
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`)
}
