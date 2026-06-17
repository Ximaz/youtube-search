import type { H3Event } from 'h3'
import { useEnv } from '../lib/env'

export interface AppSessionData {
  authenticated?: boolean
}

// Sealed (encrypted) cookie session keyed by APP_ENCRYPTION_KEY. `secure` is
// off by default because the self-hosted default is plain HTTP on localhost;
// enable it when deploying behind TLS.
export function appSession(event: H3Event) {
  return useSession<AppSessionData>(event, {
    password: useEnv().APP_ENCRYPTION_KEY,
    name: 'ys_session',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    },
  })
}

export async function isAuthenticated(event: H3Event): Promise<boolean> {
  const session = await appSession(event)
  return session.data.authenticated === true
}
