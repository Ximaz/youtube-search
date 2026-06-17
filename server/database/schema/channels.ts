import { sql } from 'drizzle-orm'
import { bigint, boolean, index, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core'
import { bit64, vector512 } from './_custom'

export const channels = pgTable('channels', {
  id: text().primaryKey(), // channel ID, e.g. "UC..."
  title: text().notNull(),
  titleNorm: text().array().notNull().default(sql`'{}'::text[]`),
  titleNormText: text().generatedAlwaysAs(sql`immutable_array_to_string(title_norm)`).notNull(),
  handle: text(),
  description: text(),

  // Rounded down to 3 significant figures by YouTube; null when hidden.
  subscriberCount: bigint({ mode: 'number' }),
  subscriberCountHidden: boolean().notNull().default(false),
  subscriberFloorSigfig: smallint().notNull().default(3),
  videoCount: bigint({ mode: 'number' }),
  viewCount: bigint({ mode: 'number' }),

  avatarPhash: bit64(),
  avatarClip: vector512(), // reserved for v2 CLIP
  avatarS3Key: text('avatar_s3_key'),
  avatarSourceRes: text(),

  etag: text(),
  lastFetchedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('channels_title_norm_idx').using('gin', t.titleNorm),
  index('channels_title_norm_text_trgm_idx').using('gin', t.titleNormText.op('gin_trgm_ops')),
  index('channels_subscriber_count_idx').on(t.subscriberCount),
])
