import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// kind = 'user' (user-created; the only kind that counts as "saved") or
// 'likes' (the system Liked-videos playlist, stored under a synthetic id).
export const playlists = pgTable('playlists', {
  id: text().primaryKey(),
  title: text().notNull(),
  privacyStatus: text(),
  kind: text().notNull().default('user'),
  itemCount: integer(),
  etag: text(),
  lastFetchedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('playlists_kind_idx').on(t.kind),
])
