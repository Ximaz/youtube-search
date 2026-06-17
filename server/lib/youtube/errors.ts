export type YoutubeAuthCode
  = | 'not_connected' // no account connected yet
    | 'token_invalid' // refresh token revoked/expired → user must reconnect
    | 'exchange_failed' // code→token exchange failed
    | 'refresh_failed' // transient refresh failure

export class YoutubeAuthError extends Error {
  constructor(readonly code: YoutubeAuthCode, message?: string) {
    super(message ?? code)
    this.name = 'YoutubeAuthError'
  }
}

// Thrown when the daily quota is exhausted and the worker is parked until the
// next Pacific-midnight reset.
export class QuotaParkedError extends Error {
  constructor(readonly resumeInSeconds: number) {
    super(`quota exhausted; parked for ${resumeInSeconds}s`)
    this.name = 'QuotaParkedError'
  }
}

// Wraps a non-2xx YouTube Data API response. `reason` is the parsed
// error.errors[].reason (e.g. 'quotaExceeded', 'rateLimitExceeded').
export class YoutubeApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message?: string,
  ) {
    super(message ?? `${status} ${reason}`)
    this.name = 'YoutubeApiError'
  }

  get isQuotaExceeded(): boolean {
    return this.reason === 'quotaExceeded' || this.reason === 'dailyLimitExceeded'
  }

  get isRateLimited(): boolean {
    return this.reason === 'rateLimitExceeded' || this.reason === 'userRateLimitExceeded'
  }
}
