import { z } from 'zod'

// Server-only configuration, validated once from process.env. Used by both the
// Nitro server and the standalone ingestion worker, so it never depends on
// Nuxt/Nitro globals. Nothing here is ever exposed to the client.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Connection URLs (the app's only handle on each backing service).
  DATABASE_URL: z.string().min(1), // postgresql://user:pass@host:5432/db
  CACHE_URL: z.string().min(1), // redis://user:pass@host:6379
  STORAGE_URL: z.string().min(1), // s3://accessKey:secretKey@host:port/bucket?region=..

  // Mandatory secrets (fail-fast at boot if missing/weak).
  APP_ENCRYPTION_KEY: z.string().min(32, 'must be at least 32 characters'),
  APP_PASSWORD: z.string().min(1),

  // Google OAuth (read-only YouTube access).
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  OAUTH_REDIRECT_URI: z.string().min(1),

  // Non-secret tunable: staleness threshold for refreshing mutable stats.
  RESYNC_STALE_AFTER_DAYS: z.coerce.number().int().positive().default(30),
})

export type Env = z.infer<typeof EnvSchema>

let cached: Env | null = null

export function useEnv(): Env {
  if (cached) return cached
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  cached = parsed.data
  return cached
}
