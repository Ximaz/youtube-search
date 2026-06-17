import { randomBytes } from 'node:crypto'
import { useCache } from '../../lib/cache'
import { buildAuthUrl } from '../../lib/youtube/oauth'

// Start the OAuth flow: mint a single-use CSRF `state`, store it in Valkey with
// a short TTL, and redirect to Google's consent screen.
export default defineEventHandler(async (event) => {
  const state = randomBytes(32).toString('base64url')
  await useCache().set(`yt:oauth:state:${state}`, '1', 'EX', 600)
  await sendRedirect(event, buildAuthUrl(state), 302)
})
