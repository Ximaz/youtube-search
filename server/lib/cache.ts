import { Redis } from 'ioredis'
import { useEnv } from './env'

// Valkey (Redis-protocol) client. Uses: OAuth state, access-token cache,
// sync job/cursor coordination, single-flight locks, quota progress counter.
let cached: Redis | null = null

export function useCache(): Redis {
  if (!cached) {
    cached = new Redis(useEnv().CACHE_URL, {
      // Don't fail in-flight commands during brief reconnects.
      maxRetriesPerRequest: null,
    })
  }
  return cached
}
