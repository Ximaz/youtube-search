import { eq } from 'drizzle-orm'
import { videoComments, videos } from '../../database/schema'
import { useDb } from '../db'
import { normalizeTokens } from '../text/normalize'
import { listCommentThreadsPage } from '../youtube/api'

// Cap pages per video to bound quota on videos with huge comment sections.
const MAX_PAGES_PER_VIDEO = 20

// Scans a video for the authenticated user's OWN comments (no server-side author
// filter exists), caches them, and stamps comments_scanned_at so empty results
// are cached too. Idempotent.
export async function scanVideoComments(videoId: string, ownChannelId: string): Promise<number> {
  const db = useDb()
  let pageToken: string | undefined
  let found = 0
  let disabled = false

  for (let page = 0; page < MAX_PAGES_PER_VIDEO; page++) {
    const res = await listCommentThreadsPage(videoId, pageToken)
    if (res.commentsDisabled) {
      disabled = true
      break
    }
    for (const comment of res.items) {
      if (comment.authorChannelId !== ownChannelId) continue
      const norm = normalizeTokens(comment.textDisplay)
      await db.insert(videoComments)
        .values({
          id: comment.id,
          videoId,
          parentId: comment.parentId,
          authorChannelId: ownChannelId,
          textDisplay: comment.textDisplay,
          textNorm: norm,
          publishedAt: comment.publishedAt ? new Date(comment.publishedAt) : null,
        })
        .onConflictDoUpdate({
          target: videoComments.id,
          set: { textDisplay: comment.textDisplay, textNorm: norm, scannedAt: new Date() },
        })
      found++
    }
    if (!res.nextPageToken) break
    pageToken = res.nextPageToken
  }

  await db.update(videos)
    .set({ commentsScannedAt: new Date(), commentsDisabled: disabled, updatedAt: new Date() })
    .where(eq(videos.id, videoId))
  return found
}
