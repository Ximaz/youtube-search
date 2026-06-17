import { sql } from 'drizzle-orm'
import { useCache } from '../lib/cache'
import { useDb } from '../lib/db'
import { storageReachable } from '../lib/storage'

// Public liveness/readiness probe. Database + cache are required for "ok";
// storage is reported but not required (it's a started, not healthchecked,
// dependency and may still be coming up).
export default defineEventHandler(async (event) => {
  const checks = { database: false, cache: false, storage: false }

  try {
    await useDb().execute(sql`select 1`)
    checks.database = true
  }
  catch { /* reported as false */ }

  try {
    checks.cache = (await useCache().ping()) === 'PONG'
  }
  catch { /* reported as false */ }

  checks.storage = await storageReachable()

  const healthy = checks.database && checks.cache
  setResponseStatus(event, healthy ? 200 : 503)
  return { status: healthy ? 'ok' : 'degraded', checks }
})
