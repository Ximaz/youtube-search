import { z } from 'zod'
import { safeEqual } from '../../lib/crypto'
import { useEnv } from '../../lib/env'

const Body = z.object({ password: z.string() })

export default defineEventHandler(async (event) => {
  const { password } = await readValidatedBody(event, body => Body.parse(body))
  if (!safeEqual(password, useEnv().APP_PASSWORD)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }
  const session = await appSession(event)
  await session.update({ authenticated: true })
  return { authenticated: true }
})
