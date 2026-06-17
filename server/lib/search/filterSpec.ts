import { z } from 'zod'

// A rough numeric target with optional tolerance %, or an explicit min/max
// range. Used for views / likes / comments / subscribers / duration.
const NumericFilter = z.object({
  value: z.number().nonnegative().optional(),
  min: z.number().nonnegative().optional(),
  max: z.number().nonnegative().optional(),
  tolerancePct: z.number().min(0).max(100).optional(),
}).optional()

export type NumericFilter = z.infer<typeof NumericFilter>

export const FilterSpecSchema = z.object({
  // Scrambled-word text filters (raw strings; normalized server-side).
  title: z.string().optional(),
  description: z.string().optional(),
  channelTitle: z.string().optional(),

  // Published date with an out-of-bound ± days cursor.
  published: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    outOfBoundDays: z.number().min(0).max(3650).optional(),
  }).optional(),

  viewCount: NumericFilter,
  likeCount: NumericFilter,
  commentCount: NumericFilter,
  subscriberCount: NumericFilter,
  durationSeconds: NumericFilter, // UI sends seconds (parsed from HH:MM:SS)

  subscribed: z.boolean().optional(),
  saved: z.object({
    state: z.boolean(),
    playlistIds: z.array(z.string()).optional(),
  }).optional(),

  // Perceptual-hash image match (Hamming distance threshold). phash is a 64-bit
  // "0"/"1" string from /api/image-search.
  thumbnail: z.object({
    phash: z.string().regex(/^[01]{64}$/),
    threshold: z.number().int().min(0).max(64).default(10),
  }).optional(),
  channelAvatar: z.object({
    phash: z.string().regex(/^[01]{64}$/),
    threshold: z.number().int().min(0).max(64).default(10),
  }).optional(),

  // Match against the user's OWN cached comments (one or more fragments). mode
  // 'all' = every fragment must match some comment; 'any' = at least one.
  ownComments: z.object({
    texts: z.array(z.string().min(1)).min(1),
    mode: z.enum(['all', 'any']).default('all'),
  }).optional(),

  // When true (default), rows whose underlying value is unknown/hidden are
  // NOT excluded by numeric filters.
  includeUnknownNumeric: z.boolean().default(true),
  includeDeleted: z.boolean().default(false),

  sort: z.enum([
    'published_desc', 'published_asc', 'views_desc', 'likes_desc', 'duration_desc', 'duration_asc',
  ]).default('published_desc'),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

export type FilterSpec = z.infer<typeof FilterSpecSchema>
