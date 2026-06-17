import { useCache } from '../cache'
import { QuotaParkedError, YoutubeApiError } from './errors'

// Reactive quota handling: Google exposes no remaining-quota header, so we make
// calls until a `403 quotaExceeded`, then park until the next Pacific-midnight
// reset. Transient errors (rate limit / 5xx / network) get exponential backoff
// with full jitter.
const PARK_KEY = 'yt:quota:parked'
const MAX_ATTEMPTS = 6
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 60_000

export function backoffDelayMs(attempt: number): number {
  const ceiling = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt)
  return Math.floor(Math.random() * ceiling)
}

// Seconds until the next midnight in America/Los_Angeles (the quota reset).
export function secondsUntilPacificMidnight(now: Date = new Date()): number {
  const pacificNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const nextMidnight = new Date(pacificNow)
  nextMidnight.setHours(24, 0, 0, 0)
  return Math.max(60, Math.ceil((nextMidnight.getTime() - pacificNow.getTime()) / 1000))
}

export async function isParked(): Promise<boolean> {
  return (await useCache().exists(PARK_KEY)) === 1
}

async function park(): Promise<number> {
  const ttl = secondsUntilPacificMidnight()
  await useCache().set(PARK_KEY, '1', 'EX', ttl)
  return ttl
}

function isTransient(error: unknown): boolean {
  if (error instanceof YoutubeApiError) return error.isRateLimited || error.status >= 500
  // Network/parse failures (e.g. fetch threw) are transient.
  return !(error instanceof QuotaParkedError)
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Runs an API call with quota-park detection + transient retry. Throws
// QuotaParkedError when the daily quota is exhausted (caller should stop).
export async function callWithQuota<T>(fn: () => Promise<T>): Promise<T> {
  if (await isParked()) throw new QuotaParkedError(await ttlRemaining())

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    }
    catch (error) {
      if (error instanceof YoutubeApiError && error.isQuotaExceeded) {
        throw new QuotaParkedError(await park())
      }
      if (isTransient(error) && attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelayMs(attempt))
        continue
      }
      throw error
    }
  }
}

async function ttlRemaining(): Promise<number> {
  const ttl = await useCache().ttl(PARK_KEY)
  return ttl > 0 ? ttl : secondsUntilPacificMidnight()
}
