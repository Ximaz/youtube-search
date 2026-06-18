import { Buffer } from 'node:buffer'
import { sql } from 'drizzle-orm'
import { Redis } from 'ioredis'
import { useCache } from './lib/cache'
import { useDb } from './lib/db'
import { useEnv } from './lib/env'
import { computePhash } from './lib/image/hash'
import { clearStaleSyncLock, runSync, SYNC_QUEUE_KEY } from './lib/ingest/sync'
import { ensureBucket } from './lib/storage'
import { YoutubeAuthError } from './lib/youtube/errors'

const TICK_SECONDS = 300
const IMG_REQ_KEY = 'img:hash:req'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Wait until the app has applied migrations (sync_state table exists).
async function waitForSchema(): Promise<void> {
  for (let i = 0; i < 150; i++) {
    try {
      await useDb().execute(sql`select 1 from sync_state limit 1`)
      return
    }
    catch {
      await sleep(2000)
    }
  }
  throw new Error('database schema not ready after waiting')
}

// One sync attempt. Resumes/advances the state machine; sleeps through quota
// parks; treats "not connected" as idle (nothing to do until the user connects).
async function tick(): Promise<void> {
  try {
    const result = await runSync()
    if (result.outcome === 'parked' && result.parkedSeconds) {
      console.info(`[worker] quota exhausted — sleeping ${result.parkedSeconds}s until reset`)
      await sleep(result.parkedSeconds * 1000)
    }
    else {
      console.info(`[worker] sync ${result.outcome} (phase=${result.phase})`)
    }
  }
  catch (error) {
    if (error instanceof YoutubeAuthError) {
      console.info(`[worker] idle: ${error.code}`)
      return
    }
    console.error('[worker] sync error:', error)
    await sleep(5000)
  }
}

// Concurrent loop: hashes query images on behalf of the web server (sharp must
// run in this main-thread process, not the Nitro dev worker). Runs alongside the
// sync loop and stays responsive during long syncs (it's all async I/O).
async function imageHashLoop(): Promise<void> {
  const conn = new Redis(useEnv().CACHE_URL, { maxRetriesPerRequest: null })
  const cache = useCache()
  for (;;) {
    let id: string | undefined
    try {
      const popped = await conn.brpop(IMG_REQ_KEY, 0)
      if (!popped) continue
      const parsed = JSON.parse(popped[1]) as { id: string, b64: string }
      id = parsed.id
      const result = await computePhash(Buffer.from(parsed.b64, 'base64'))
      await cache.lpush(`img:hash:done:${id}`, result)
      await cache.expire(`img:hash:done:${id}`, 30)
    }
    catch (error) {
      console.error('[worker] image hash error:', error)
      if (id) {
        await cache.lpush(`img:hash:done:${id}`, 'ERROR')
        await cache.expire(`img:hash:done:${id}`, 30)
      }
    }
  }
}

async function main(): Promise<void> {
  useEnv()
  await waitForSchema()
  try {
    await ensureBucket()
  }
  catch (error) {
    console.warn('[worker] storage bucket not ready yet:', error)
  }

  // A prior worker killed mid-step may have left a stale sync lock.
  await clearStaleSyncLock()

  // Dedicated connection for the blocking wait so it never holds up cache ops.
  const blocker = new Redis(useEnv().CACHE_URL, { maxRetriesPerRequest: null })
  void imageHashLoop()

  console.info('[worker] ready')
  await tick() // resume/start on boot

  for (;;) {
    // Wake on an explicit trigger, or fall through every TICK_SECONDS to resume
    // any in-progress (e.g. previously quota-parked) sync.
    await blocker.brpop(SYNC_QUEUE_KEY, TICK_SECONDS)
    await tick()
  }
}

main().catch((error) => {
  console.error('[worker] fatal:', error)
  process.exitCode = 1
})
