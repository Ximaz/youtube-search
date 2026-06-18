export type ShortStatus = 'short' | 'video' | 'error'

// A browser UA + the `SOCS` consent cookie avoid YouTube's consent-wall redirect
// (302 → consent.youtube.com) that otherwise hides the Short/regular signal.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const CONSENT_COOKIE = 'SOCS=CAI'

// A video is a YouTube Short iff youtube.com/shorts/<id> serves the Short page
// (HTTP 200); a regular video redirects to /watch (303). 404/410 = gone → treat
// as regular. A consent wall / 429 / 5xx / network error → 'error' so the caller
// defers rather than mis-caching. No API quota — a plain web request.
export async function detectShortStatus(id: string): Promise<ShortStatus> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${id}`, {
      method: 'HEAD',
      redirect: 'manual',
      headers: { 'user-agent': UA, 'cookie': CONSENT_COOKIE },
    })
    if (res.status === 200) return 'short'
    const location = res.headers.get('location') ?? ''
    if (location.includes('consent.')) return 'error' // walled — can't tell
    if (res.status === 0 || (res.status >= 300 && res.status < 400)) return 'video'
    if (res.status === 404 || res.status === 410) return 'video'
    return 'error'
  }
  catch {
    return 'error'
  }
}
