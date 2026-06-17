import { bigserial, index, integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { playlists } from './playlists'
import { videos } from './videos'

// video ↔ playlist membership — the basis for the "saved" filter and the
// which-playlist(s) breakdown.
export const playlistItems = pgTable('playlist_items', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  playlistId: text().notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  videoId: text().notNull().references(() => videos.id, { onDelete: 'cascade' }),
  position: integer(),
  addedAt: timestamp({ withTimezone: true }), // playlistItem publishedAt = when added
  playlistItemId: text(), // YouTube's playlistItem.id (for de-dup/etag)
}, t => [
  unique('playlist_items_playlist_video_uniq').on(t.playlistId, t.videoId),
  index('playlist_items_video_id_idx').on(t.videoId),
  index('playlist_items_playlist_id_idx').on(t.playlistId),
])
