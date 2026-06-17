import { describe, expect, it } from 'vitest'
import { backoffDelayMs, secondsUntilPacificMidnight } from '../server/lib/youtube/quota'

describe('backoffDelayMs', () => {
  it('stays within the full-jitter exponential ceiling', () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const ceiling = Math.min(60_000, 1000 * 2 ** attempt)
      for (let i = 0; i < 50; i++) {
        const delay = backoffDelayMs(attempt)
        expect(delay).toBeGreaterThanOrEqual(0)
        expect(delay).toBeLessThanOrEqual(ceiling)
      }
    }
  })
})

describe('secondsUntilPacificMidnight', () => {
  it('returns a positive value within a day', () => {
    const s = secondsUntilPacificMidnight()
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThanOrEqual(86_400)
  })
})
