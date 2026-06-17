import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Singleton row holding the resumable ingestion state machine + cursors.
// Postgres is the durable source of truth; Valkey mirrors the hot working set.
export const syncState = pgTable('sync_state', {
  id: integer().primaryKey().default(1),
  // idle | me | playlists | likes | playlist_items | hydrate_videos
  // | hydrate_channels | subscriptions | images | done
  phase: text().notNull().default('idle'),
  currentPlaylistId: text(),
  pageToken: text(),
  pendingVideoIds: text().array().notNull().default(sql`'{}'::text[]`),
  pendingChannelIds: text().array().notNull().default(sql`'{}'::text[]`),
  // True once the Likes playlist stops paging early (undocumented ~5k cap).
  likesCapHit: boolean().notNull().default(false),
  lastFullSyncAt: timestamp({ withTimezone: true }),
  lastError: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, () => [
  check('sync_state_singleton', sql`id = 1`),
])
