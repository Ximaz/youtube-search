import { sql } from 'drizzle-orm'
import { bigint, boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { bit64, tsvector, vector512 } from './_custom'
import { channels } from './channels'

export const videos = pgTable('videos', {
  id: text().primaryKey(), // video ID
  channelId: text().references(() => channels.id),

  title: text().notNull(),
  titleNorm: text().array().notNull().default(sql`'{}'::text[]`),
  titleTsv: tsvector()
    .generatedAlwaysAs(sql`to_tsvector('simple', coalesce(title, ''))`)
    .notNull(),
  description: text(),
  descriptionNorm: text().array().notNull().default(sql`'{}'::text[]`),
  descriptionTsv: tsvector()
    .generatedAlwaysAs(sql`to_tsvector('simple', coalesce(description, ''))`)
    .notNull(),
  // Normalized text (joined token arrays) for diacritic-insensitive, trgm-indexed
  // substring matching.
  titleNormText: text().generatedAlwaysAs(sql`immutable_array_to_string(title_norm)`).notNull(),
  descriptionNormText: text().generatedAlwaysAs(sql`immutable_array_to_string(description_norm)`).notNull(),

  // Publish time (ISO 8601). YouTube exposes no distinct "upload date".
  publishedAt: timestamp({ withTimezone: true }),
  durationSeconds: integer(),
  isLiveOrUpcoming: boolean().notNull().default(false),

  // All stats may be absent when the uploader hides/disables them → null.
  viewCount: bigint({ mode: 'number' }),
  likeCount: bigint({ mode: 'number' }),
  commentCount: bigint({ mode: 'number' }),
  statsHidden: boolean().notNull().default(false),

  thumbPhash: bit64(),
  thumbClip: vector512(), // reserved for v2 CLIP
  thumbS3Key: text('thumb_s3_key'),
  thumbSourceRes: text(),

  commentsScannedAt: timestamp({ withTimezone: true }),
  commentsDisabled: boolean().notNull().default(false),

  privacyStatus: text(),
  // Deletion safety net: set when a known id vanishes from a re-sync.
  deletedFromYoutube: boolean().notNull().default(false),

  etag: text(),
  lastFetchedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('videos_title_norm_idx').using('gin', t.titleNorm),
  index('videos_description_norm_idx').using('gin', t.descriptionNorm),
  index('videos_title_tsv_idx').using('gin', t.titleTsv),
  index('videos_description_tsv_idx').using('gin', t.descriptionTsv),
  index('videos_title_norm_text_trgm_idx').using('gin', t.titleNormText.op('gin_trgm_ops')),
  index('videos_description_norm_text_trgm_idx').using('gin', t.descriptionNormText.op('gin_trgm_ops')),
  index('videos_published_at_idx').on(t.publishedAt),
  index('videos_view_count_idx').on(t.viewCount),
  index('videos_like_count_idx').on(t.likeCount),
  index('videos_comment_count_idx').on(t.commentCount),
  index('videos_duration_idx').on(t.durationSeconds),
  index('videos_channel_id_idx').on(t.channelId),
])
