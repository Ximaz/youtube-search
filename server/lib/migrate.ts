import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { useCache } from './cache'
import { useEnv } from './env'

const MIGRATIONS_DIR = resolve(process.cwd(), 'server/database/migrations')
const LOCK_KEY = 'migrate:lock'

// Applies pending migrations under a Valkey single-flight lock so the app and
// worker never race. The non-holder waits until the holder releases the lock
// (i.e. migrations are done).
export async function runMigrations(): Promise<void> {
  const cache = useCache()
  const acquired = await cache.set(LOCK_KEY, '1', 'EX', 300, 'NX')
  if (!acquired) {
    await waitForLockRelease(cache)
    return
  }
  try {
    const sql = postgres(useEnv().DATABASE_URL, { max: 1 })
    try {
      await migrate(drizzle(sql), { migrationsFolder: MIGRATIONS_DIR })
    }
    finally {
      await sql.end({ timeout: 5 })
    }
  }
  finally {
    await cache.del(LOCK_KEY)
  }
}

async function waitForLockRelease(cache: ReturnType<typeof useCache>): Promise<void> {
  for (let i = 0; i < 120; i++) {
    if (!(await cache.exists(LOCK_KEY))) return
    await new Promise(resolveDelay => setTimeout(resolveDelay, 1000))
  }
  throw new Error('Timed out waiting for migrations to complete')
}
