import { requestFullSync } from '../../lib/ingest/sync'
import { getConnectionStatus } from '../../lib/youtube/oauth'

// Reset to a fresh full sync and wake the worker.
export default defineEventHandler(async () => {
  const status = await getConnectionStatus()
  if (!status.connected) {
    throw createError({ statusCode: 409, statusMessage: 'YouTube account not connected' })
  }
  await requestFullSync()
  return { triggered: true }
})
