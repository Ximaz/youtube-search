import { customType } from 'drizzle-orm/pg-core'

// 64-bit perceptual-hash column. Stored as Postgres `bit(64)` so Hamming
// distance is `bit_count(a # b)` directly (no casts, no sign juggling). The TS
// value is a 64-char "0"/"1" string (what sharp-phash returns).
export const bit64 = customType<{ data: string, driverData: string }>({
  dataType() {
    return 'bit(64)'
  },
})

// pgvector column reserved for v2 CLIP embeddings (ViT-B/32 → 512 dims).
// Nullable everywhere in v1; no HNSW index until the CLIP backfill ships.
export const vector512 = customType<{ data: number[], driverData: string }>({
  dataType() {
    return 'vector(512)'
  },
  toDriver(value) {
    return `[${value.join(',')}]`
  },
  fromDriver(value) {
    return JSON.parse(value as string) as number[]
  },
})

// Postgres full-text search vector (generated stored columns use the 'simple'
// config so exact user tokens are never stemmed/stop-worded away).
export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})
