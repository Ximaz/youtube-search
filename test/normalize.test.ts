import { describe, expect, it } from 'vitest'
import { normalizeText, normalizeTokens } from '../server/lib/text/normalize'

describe('normalizeText', () => {
  it('lowercases, strips diacritics and trims', () => {
    expect(normalizeText('  CRÈME Brûlée  ')).toBe('creme brulee')
  })
})

describe('normalizeTokens', () => {
  it('splits on whitespace and punctuation, de-duplicates', () => {
    expect(normalizeTokens('Hello, hello-world!')).toEqual(['hello', 'world'])
  })

  it('is order-independent and case-insensitive (scrambled-word match)', () => {
    const a = normalizeTokens('Never Gonna Give You Up').sort()
    const b = normalizeTokens('up YOU give gonna never').sort()
    expect(a).toEqual(b)
  })

  it('keeps alphanumerics and drops empty tokens', () => {
    expect(normalizeTokens('  4K   video!!  ')).toEqual(['4k', 'video'])
  })
})
