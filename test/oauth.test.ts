import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildAuthUrl, exchangeCodeForTokens } from '../server/lib/youtube/oauth'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildAuthUrl', () => {
  it('requests offline access with the catalog + comment scopes and given state', () => {
    const url = new URL(buildAuthUrl('state-xyz'))
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('state')).toBe('state-xyz')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('scope')).toContain('youtube.readonly')
    // commentThreads.list needs force-ssl; readonly alone 403s with insufficient scopes.
    expect(url.searchParams.get('scope')).toContain('youtube.force-ssl')
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
  })
})

describe('exchangeCodeForTokens', () => {
  it('posts the code and returns the parsed tokens', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 's', token_type: 'Bearer' }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const tokens = await exchangeCodeForTokens('the-code')
    expect(tokens.access_token).toBe('a')
    expect(tokens.refresh_token).toBe('r')

    const [, init] = fetchMock.mock.calls[0]
    expect((init?.body as URLSearchParams).get('code')).toBe('the-code')
    expect((init?.body as URLSearchParams).get('grant_type')).toBe('authorization_code')
  })

  it('throws on a non-2xx token response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad', { status: 400 })))
    await expect(exchangeCodeForTokens('x')).rejects.toThrow()
  })
})
