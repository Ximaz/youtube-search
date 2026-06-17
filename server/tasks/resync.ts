import { requestFullSync } from '../lib/ingest/sync'
import { getConnectionStatus } from '../lib/youtube/oauth'

// Nightly incremental re-sync: re-enumerates playlists/likes (catching new
// videos), refreshes stale stats, and reconciles subscriptions. The worker
// drains the queued job. No-op when no account is connected.
export default defineTask({
  meta: { name: 'resync', description: 'Nightly incremental re-sync' },
  async run() {
    const status = await getConnectionStatus()
    if (!status.connected) return { result: 'skipped: not connected' }
    await requestFullSync()
    return { result: 'queued' }
  },
})
