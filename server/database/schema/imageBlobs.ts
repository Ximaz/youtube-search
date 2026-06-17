import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { bit64 } from './_custom'

// S3 storage ledger — one row per stored resolution of an entity's image.
// Enables the multi-resolution / min-Hamming-distance match (a high-quality
// upload can be compared against the creator's actual lower-res variant).
export const imageBlobs = pgTable('image_blobs', {
  s3Key: text().primaryKey(),
  entityType: text().notNull(), // 'video_thumb' | 'channel_avatar'
  entityId: text().notNull(), // video_id or channel_id
  resolution: text().notNull(), // 'maxres' | 'standard' | 'high' | 'medium' | 'default'
  sourceUrl: text().notNull(),
  phash: bit64(),
  dhash: bit64(),
  contentType: text(),
  bytes: integer(),
  fetchedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('image_blobs_entity_idx').on(t.entityType, t.entityId),
])
