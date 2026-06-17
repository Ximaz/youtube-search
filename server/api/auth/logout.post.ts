import { disconnect } from '../../lib/youtube/oauth'

// Disconnects the YouTube account (drops tokens) but keeps the cached catalog.
export default defineEventHandler(async () => {
  await disconnect()
  return { connected: false }
})
