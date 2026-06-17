import { parseIsoDurationToSeconds } from './duration'
import { YoutubeApiError } from './errors'
import { getValidAccessToken } from './oauth'
import type { OwnChannel } from './oauth'
import { callWithQuota } from './quota'

const YT_BASE = 'https://www.googleapis.com/youtube/v3'

interface YoutubeErrorBody {
  error?: { errors?: { reason?: string }[], status?: string, message?: string }
}

// Single authenticated GET against the YouTube Data API. Parses the canonical
// error.errors[].reason so callers can react to quota/rate-limit codes.
export async function youtubeGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const url = `${YT_BASE}/${path}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  const json = await res.json() as T & YoutubeErrorBody
  if (!res.ok) {
    const reason = json.error?.errors?.[0]?.reason ?? json.error?.status ?? 'unknown'
    throw new YoutubeApiError(res.status, reason, json.error?.message)
  }
  return json
}

// Token-refreshing, quota-aware GET used by all ingestion calls.
async function ytApi<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await getValidAccessToken()
  return callWithQuota(() => youtubeGet<T>(path, params, token))
}

const parseCount = (v: string | undefined): number | null => (v == null ? null : Number(v))

// ---- thumbnails ----
export interface Thumbnail { url: string, width?: number, height?: number }
export type Thumbnails = Partial<Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', Thumbnail>>

// ---- channels.list?mine=true (own channel) ----
interface ChannelsListResponse {
  items?: {
    id: string
    snippet?: { title?: string, description?: string, thumbnails?: Thumbnails }
    statistics?: { subscriberCount?: string, hiddenSubscriberCount?: boolean, videoCount?: string, viewCount?: string }
    contentDetails?: { relatedPlaylists?: { likes?: string, uploads?: string } }
  }[]
}

export interface MyChannel extends OwnChannel {
  likesPlaylistId: string | null
  uploadsPlaylistId: string | null
}

export async function getMyChannel(accessToken: string): Promise<MyChannel | null> {
  const data = await youtubeGet<ChannelsListResponse>(
    'channels',
    { part: 'id,snippet,contentDetails', mine: 'true' },
    accessToken,
  )
  const channel = data.items?.[0]
  if (!channel) return null
  return {
    id: channel.id,
    title: channel.snippet?.title ?? channel.id,
    likesPlaylistId: channel.contentDetails?.relatedPlaylists?.likes ?? null,
    uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads ?? null,
  }
}

// ---- playlists.list?mine=true ----
interface PlaylistsListResponse {
  nextPageToken?: string
  items?: {
    id: string
    snippet?: { title?: string }
    status?: { privacyStatus?: string }
    contentDetails?: { itemCount?: number }
  }[]
}

export interface PlaylistData {
  id: string
  title: string
  privacyStatus: string | null
  itemCount: number | null
}

export interface Page<T> {
  items: T[]
  nextPageToken: string | null
}

export async function listMyPlaylistsPage(pageToken?: string): Promise<Page<PlaylistData>> {
  const data = await ytApi<PlaylistsListResponse>('playlists', {
    part: 'snippet,status,contentDetails',
    mine: 'true',
    maxResults: '50',
    ...(pageToken ? { pageToken } : {}),
  })
  return {
    items: (data.items ?? []).map(p => ({
      id: p.id,
      title: p.snippet?.title ?? p.id,
      privacyStatus: p.status?.privacyStatus ?? null,
      itemCount: p.contentDetails?.itemCount ?? null,
    })),
    nextPageToken: data.nextPageToken ?? null,
  }
}

// ---- playlistItems.list ----
interface PlaylistItemsListResponse {
  nextPageToken?: string
  items?: {
    id: string
    snippet?: { position?: number, publishedAt?: string }
    contentDetails?: { videoId?: string }
  }[]
}

export interface PlaylistItemData {
  videoId: string
  position: number | null
  addedAt: string | null
  playlistItemId: string
}

export async function listPlaylistItemsPage(playlistId: string, pageToken?: string): Promise<Page<PlaylistItemData>> {
  const data = await ytApi<PlaylistItemsListResponse>('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: '50',
    ...(pageToken ? { pageToken } : {}),
  })
  return {
    items: (data.items ?? [])
      .filter(i => i.contentDetails?.videoId)
      .map(i => ({
        videoId: i.contentDetails!.videoId!,
        position: i.snippet?.position ?? null,
        addedAt: i.snippet?.publishedAt ?? null,
        playlistItemId: i.id,
      })),
    nextPageToken: data.nextPageToken ?? null,
  }
}

// ---- videos.list (batch up to 50 ids) ----
interface VideosListResponse {
  items?: {
    id: string
    snippet?: {
      channelId?: string
      title?: string
      description?: string
      publishedAt?: string
      liveBroadcastContent?: string
      thumbnails?: Thumbnails
    }
    contentDetails?: { duration?: string }
    statistics?: { viewCount?: string, likeCount?: string, commentCount?: string }
  }[]
}

export interface VideoData {
  id: string
  channelId: string | null
  title: string
  description: string | null
  publishedAt: string | null
  durationSeconds: number | null
  isLiveOrUpcoming: boolean
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  statsHidden: boolean
  thumbnails: Thumbnails
}

export async function getVideosBatch(ids: string[]): Promise<VideoData[]> {
  if (ids.length === 0) return []
  const data = await ytApi<VideosListResponse>('videos', {
    part: 'snippet,contentDetails,statistics',
    id: ids.slice(0, 50).join(','),
    maxResults: '50',
  })
  return (data.items ?? []).map((v) => {
    const live = v.snippet?.liveBroadcastContent
    return {
      id: v.id,
      channelId: v.snippet?.channelId ?? null,
      title: v.snippet?.title ?? '',
      description: v.snippet?.description ?? null,
      publishedAt: v.snippet?.publishedAt ?? null,
      durationSeconds: parseIsoDurationToSeconds(v.contentDetails?.duration),
      isLiveOrUpcoming: live != null && live !== 'none',
      viewCount: parseCount(v.statistics?.viewCount),
      likeCount: parseCount(v.statistics?.likeCount),
      commentCount: parseCount(v.statistics?.commentCount),
      statsHidden: v.statistics == null,
      thumbnails: v.snippet?.thumbnails ?? {},
    }
  })
}

// ---- channels.list (batch up to 50 ids) ----
export interface ChannelData {
  id: string
  title: string
  description: string | null
  subscriberCount: number | null
  hiddenSubscriberCount: boolean
  videoCount: number | null
  viewCount: number | null
  thumbnails: Thumbnails
}

export async function getChannelsBatch(ids: string[]): Promise<ChannelData[]> {
  if (ids.length === 0) return []
  const data = await ytApi<ChannelsListResponse>('channels', {
    part: 'snippet,statistics',
    id: ids.slice(0, 50).join(','),
    maxResults: '50',
  })
  return (data.items ?? []).map((c) => {
    const hidden = Boolean(c.statistics?.hiddenSubscriberCount)
    return {
      id: c.id,
      title: c.snippet?.title ?? c.id,
      description: c.snippet?.description ?? null,
      subscriberCount: hidden ? null : parseCount(c.statistics?.subscriberCount),
      hiddenSubscriberCount: hidden,
      videoCount: parseCount(c.statistics?.videoCount),
      viewCount: parseCount(c.statistics?.viewCount),
      thumbnails: c.snippet?.thumbnails ?? {},
    }
  })
}

// ---- subscriptions.list?mine=true ----
interface SubscriptionsListResponse {
  nextPageToken?: string
  items?: { snippet?: { resourceId?: { channelId?: string } } }[]
}

export async function listMySubscriptionsPage(pageToken?: string): Promise<Page<string>> {
  const data = await ytApi<SubscriptionsListResponse>('subscriptions', {
    part: 'snippet',
    mine: 'true',
    maxResults: '50',
    ...(pageToken ? { pageToken } : {}),
  })
  return {
    items: (data.items ?? [])
      .map(s => s.snippet?.resourceId?.channelId)
      .filter((id): id is string => Boolean(id)),
    nextPageToken: data.nextPageToken ?? null,
  }
}

// ---- commentThreads.list (own-comment scan) ----
interface CommentSnippet {
  authorChannelId?: { value?: string }
  textDisplay?: string
  textOriginal?: string
  publishedAt?: string
}
interface CommentThreadsListResponse {
  nextPageToken?: string
  items?: {
    snippet?: { topLevelComment?: { id: string, snippet?: CommentSnippet } }
    replies?: { comments?: { id: string, snippet?: CommentSnippet }[] }
  }[]
}

export interface CommentData {
  id: string
  parentId: string | null
  authorChannelId: string | null
  textDisplay: string
  publishedAt: string | null
}

export interface CommentsPage extends Page<CommentData> {
  commentsDisabled: boolean
}

// One page of comment threads for a video, flattened to top-level comments +
// their (truncated) replies. Returns commentsDisabled=true on a 403.
export async function listCommentThreadsPage(videoId: string, pageToken?: string): Promise<CommentsPage> {
  let data: CommentThreadsListResponse
  try {
    data = await ytApi<CommentThreadsListResponse>('commentThreads', {
      part: 'snippet,replies',
      videoId,
      maxResults: '100',
      textFormat: 'plainText',
      ...(pageToken ? { pageToken } : {}),
    })
  }
  catch (error) {
    // Only a genuine "comments disabled" should cache the video as uncommentable.
    // Other 403s (rate-limit, forbidden) must propagate, not be mis-cached.
    if (error instanceof YoutubeApiError && error.reason === 'commentsDisabled') {
      return { items: [], nextPageToken: null, commentsDisabled: true }
    }
    throw error
  }

  const comments: CommentData[] = []
  for (const thread of data.items ?? []) {
    const top = thread.snippet?.topLevelComment
    if (top?.snippet) {
      comments.push(toComment(top.id, null, top.snippet))
    }
    for (const reply of thread.replies?.comments ?? []) {
      if (reply.snippet) comments.push(toComment(reply.id, top?.id ?? null, reply.snippet))
    }
  }
  return { items: comments, nextPageToken: data.nextPageToken ?? null, commentsDisabled: false }
}

function toComment(id: string, parentId: string | null, snippet: CommentSnippet): CommentData {
  return {
    id,
    parentId,
    authorChannelId: snippet.authorChannelId?.value ?? null,
    textDisplay: snippet.textOriginal ?? snippet.textDisplay ?? '',
    publishedAt: snippet.publishedAt ?? null,
  }
}
