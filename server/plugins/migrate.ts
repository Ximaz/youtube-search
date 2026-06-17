import { ensureBucket } from '../lib/storage'
import { runMigrations } from '../lib/migrate'

// Runs once on Nitro server startup. Migrations are critical (throwing fails
// boot fast). Bucket creation is best-effort — storage may still be warming up,
// and image storage only matters once ingestion runs, so a failure here logs a
// warning rather than blocking the app.
export default defineNitroPlugin(async () => {
  await runMigrations()
  try {
    await ensureBucket()
  }
  catch (error) {
    console.warn('[boot] storage bucket not ready yet:', error)
  }
})
