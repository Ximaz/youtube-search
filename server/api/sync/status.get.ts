import { eq, sql } from 'drizzle-orm'
import { channels, playlists, subscriptions, syncState, videos } from '../../database/schema'
import { useDb } from '../../lib/db'
import { isParked } from '../../lib/youtube/quota'

// Snapshot of ingestion progress for the sync banner (reads local DB only).
export default defineEventHandler(async () => {
  const db = useDb()

  const [state] = await db.select().from(syncState).where(eq(syncState.id, 1)).limit(1)
  const [v] = await db.select({
    total: sql<number>`count(*)::int`,
    hydrated: sql<number>`count(*) filter (where last_fetched_at is not null)::int`,
  }).from(videos)
  const [c] = await db.select({ total: sql<number>`count(*)::int` }).from(channels)
  const [p] = await db.select({ total: sql<number>`count(*)::int` }).from(playlists)
  const [s] = await db.select({ total: sql<number>`count(*) filter (where subscribed)::int` }).from(subscriptions)

  return {
    phase: state?.phase ?? 'idle',
    lastError: state?.lastError ?? null,
    lastFullSyncAt: state?.lastFullSyncAt ?? null,
    parked: await isParked(),
    counts: {
      videos: v?.total ?? 0,
      videosHydrated: v?.hydrated ?? 0,
      channels: c?.total ?? 0,
      playlists: p?.total ?? 0,
      subscriptions: s?.total ?? 0,
    },
  }
})
