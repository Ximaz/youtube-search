import { sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { tsvector } from './_custom'
import { videos } from './videos'

// Cached copies of the authenticated user's OWN comments, populated by the
// hybrid on-demand scan. `videos.commentsScannedAt` marks a video as scanned so
// empty results are cached too (no rescan).
export const videoComments = pgTable('video_comments', {
  id: text().primaryKey(), // comment ID
  videoId: text().notNull().references(() => videos.id, { onDelete: 'cascade' }),
  parentId: text(), // null = top-level, else a reply
  authorChannelId: text().notNull(), // always == oauth_account.own_channel_id
  textDisplay: text().notNull(),
  textNorm: text().array().notNull().default(sql`'{}'::text[]`),
  textTsv: tsvector()
    .generatedAlwaysAs(sql`to_tsvector('simple', coalesce(text_display, ''))`)
    .notNull(),
  textNormText: text().generatedAlwaysAs(sql`immutable_array_to_string(text_norm)`).notNull(),
  publishedAt: timestamp({ withTimezone: true }),
  scannedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('video_comments_text_norm_idx').using('gin', t.textNorm),
  index('video_comments_text_norm_text_trgm_idx').using('gin', t.textNormText.op('gin_trgm_ops')),
  index('video_comments_text_tsv_idx').using('gin', t.textTsv),
  index('video_comments_video_id_idx').on(t.videoId),
])
