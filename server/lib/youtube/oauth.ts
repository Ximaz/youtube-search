import { eq } from 'drizzle-orm'
import { channels, oauthAccount } from '../../database/schema'
import { useCache } from '../cache'
import { decryptSecret, encryptSecret } from '../crypto'
import { useDb } from '../db'
import { useEnv } from '../env'
import { normalizeTokens } from '../text/normalize'
import { YoutubeAuthError } from './errors'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
// All catalog reads work under youtube.readonly. Comments are the exception:
// commentThreads.list is not covered by readonly and only accepts force-ssl
// (YouTube offers no read-only comment scope). We never write — we only read.
const SCOPE = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
].join(' ')
const ACCESS_TOKEN_CACHE_KEY = 'yt:access_token'
const EXPIRY_SLACK_MS = 60_000

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export interface OwnChannel {
  id: string
  title: string
}

// Step 1: the consent URL. `state` is a single-use CSRF token the caller stores
// in Valkey and verifies on callback.
export function buildAuthUrl(state: string): string {
  const env = useEnv()
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const env = useEnv()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    throw new YoutubeAuthError('exchange_failed', await res.text())
  }
  return await res.json() as TokenResponse
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const env = useEnv()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json() as TokenResponse & { error?: string }
  if (!res.ok) {
    if (json.error === 'invalid_grant') {
      throw new YoutubeAuthError('token_invalid', 'refresh token revoked or expired')
    }
    throw new YoutubeAuthError('refresh_failed', json.error ?? `HTTP ${res.status}`)
  }
  return json
}

// Persist a fresh connection: upsert the owner's channel row (so the FK is
// satisfied) and the singleton oauth_account, encrypting the refresh token.
export async function storeConnection(tokens: TokenResponse, channel: OwnChannel | null): Promise<void> {
  const db = useDb()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + tokens.expires_in * 1000)

  if (channel) {
    await db.insert(channels)
      .values({ id: channel.id, title: channel.title, titleNorm: normalizeTokens(channel.title) })
      .onConflictDoUpdate({
        target: channels.id,
        set: { title: channel.title, titleNorm: normalizeTokens(channel.title), updatedAt: now },
      })
  }

  const refreshTokenEnc = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined

  await db.insert(oauthAccount)
    .values({
      id: 1,
      ownChannelId: channel?.id ?? null,
      refreshTokenEnc: refreshTokenEnc ?? null,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: expiresAt,
      scope: tokens.scope,
      tokenInvalid: false,
    })
    .onConflictDoUpdate({
      target: oauthAccount.id,
      set: {
        ownChannelId: channel?.id ?? null,
        accessToken: tokens.access_token,
        accessTokenExpiresAt: expiresAt,
        scope: tokens.scope,
        tokenInvalid: false,
        updatedAt: now,
        // Only overwrite the stored refresh token when Google returned a new one.
        ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
      },
    })

  await cacheAccessToken(tokens.access_token, expiresAt)
}

// Returns a valid access token, refreshing (and persisting) if needed. Throws
// YoutubeAuthError('not_connected' | 'token_invalid') for the caller to handle.
export async function getValidAccessToken(): Promise<string> {
  const cache = useCache()
  const cached = await cache.get(ACCESS_TOKEN_CACHE_KEY)
  if (cached) return cached

  const db = useDb()
  const [row] = await db.select().from(oauthAccount).where(eq(oauthAccount.id, 1)).limit(1)
  if (!row?.refreshTokenEnc) throw new YoutubeAuthError('not_connected')
  if (row.tokenInvalid) throw new YoutubeAuthError('token_invalid')

  if (row.accessToken && row.accessTokenExpiresAt
    && row.accessTokenExpiresAt.getTime() > Date.now() + EXPIRY_SLACK_MS) {
    await cacheAccessToken(row.accessToken, row.accessTokenExpiresAt)
    return row.accessToken
  }

  try {
    const refreshed = await refreshAccessToken(decryptSecret(row.refreshTokenEnc))
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
    await db.update(oauthAccount)
      .set({ accessToken: refreshed.access_token, accessTokenExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(oauthAccount.id, 1))
    await cacheAccessToken(refreshed.access_token, expiresAt)
    return refreshed.access_token
  }
  catch (error) {
    if (error instanceof YoutubeAuthError && error.code === 'token_invalid') {
      await db.update(oauthAccount).set({ tokenInvalid: true, updatedAt: new Date() }).where(eq(oauthAccount.id, 1))
    }
    throw error
  }
}

export interface ConnectionStatus {
  connected: boolean
  channelId: string | null
  tokenInvalid: boolean
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const [row] = await useDb().select().from(oauthAccount).where(eq(oauthAccount.id, 1)).limit(1)
  return {
    connected: Boolean(row?.refreshTokenEnc) && !row?.tokenInvalid,
    channelId: row?.ownChannelId ?? null,
    tokenInvalid: row?.tokenInvalid ?? false,
  }
}

// Disconnect: drop tokens but keep the cached catalog (the deletion safety net).
export async function disconnect(): Promise<void> {
  await useCache().del(ACCESS_TOKEN_CACHE_KEY)
  await useDb().update(oauthAccount)
    .set({ refreshTokenEnc: null, accessToken: null, accessTokenExpiresAt: null, tokenInvalid: false, updatedAt: new Date() })
    .where(eq(oauthAccount.id, 1))
}

async function cacheAccessToken(token: string, expiresAt: Date): Promise<void> {
  const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000) - 60
  if (ttl > 0) await useCache().set(ACCESS_TOKEN_CACHE_KEY, token, 'EX', ttl)
}
