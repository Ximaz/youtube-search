import { z } from 'zod'
import { useCache } from '../../lib/cache'
import { getMyChannel } from '../../lib/youtube/api'
import { exchangeCodeForTokens, storeConnection } from '../../lib/youtube/oauth'

const Query = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
})

// OAuth callback: verify the single-use state, exchange the code, capture the
// owner's channel, and persist the (encrypted) connection.
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, value => Query.parse(value))

  if (query.error) {
    return sendRedirect(event, `/?connect_error=${encodeURIComponent(query.error)}`, 302)
  }
  if (!query.code || !query.state) {
    throw createError({ statusCode: 400, statusMessage: 'Missing authorization code or state' })
  }

  // Single-use state: DEL returns 1 only if the key existed.
  const consumed = await useCache().del(`yt:oauth:state:${query.state}`)
  if (consumed !== 1) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid or expired state' })
  }

  const tokens = await exchangeCodeForTokens(query.code)
  const channel = await getMyChannel(tokens.access_token)
  await storeConnection(tokens, channel)

  return sendRedirect(event, '/?connected=1', 302)
})
