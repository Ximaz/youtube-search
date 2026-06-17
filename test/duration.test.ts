import { describe, expect, it } from 'vitest'
import { hmsToSeconds, parseIsoDurationToSeconds, secondsToHms } from '../server/lib/youtube/duration'

describe('parseIsoDurationToSeconds', () => {
  it('parses common video durations', () => {
    expect(parseIsoDurationToSeconds('PT15M33S')).toBe(933)
    expect(parseIsoDurationToSeconds('PT1H2S')).toBe(3602)
    expect(parseIsoDurationToSeconds('PT45S')).toBe(45)
    expect(parseIsoDurationToSeconds('P1DT2H')).toBe(93_600)
  })

  it('treats live/upcoming zero durations as 0 and rejects junk', () => {
    expect(parseIsoDurationToSeconds('P0D')).toBe(0)
    expect(parseIsoDurationToSeconds('PT0S')).toBe(0)
    expect(parseIsoDurationToSeconds('not-a-duration')).toBeNull()
    expect(parseIsoDurationToSeconds(null)).toBeNull()
  })
})

describe('secondsToHms', () => {
  it('formats with and without hours', () => {
    expect(secondsToHms(933)).toBe('15:33')
    expect(secondsToHms(3733)).toBe('1:02:13')
    expect(secondsToHms(5)).toBe('0:05')
  })
})

describe('hmsToSeconds', () => {
  it('parses HH:MM:SS / MM:SS / SS', () => {
    expect(hmsToSeconds('00:12:45')).toBe(765)
    expect(hmsToSeconds('12:45')).toBe(765)
    expect(hmsToSeconds('1:30:00')).toBe(5400)
    expect(hmsToSeconds('90')).toBe(90)
  })

  it('rejects base-100 / malformed input', () => {
    expect(hmsToSeconds('12:99')).toBeNull()
    expect(hmsToSeconds('a:b')).toBeNull()
    expect(hmsToSeconds('1:2:3:4')).toBeNull()
    expect(hmsToSeconds('')).toBeNull()
  })
})
