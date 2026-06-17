// Shared text normalization used by BOTH ingestion (building *_norm token
// arrays) and search (building query tokens). They MUST use the same function
// or the `text[] @>` contains-all matching breaks.

// NFKD-decompose, strip diacritics/combining marks, lowercase, trim.
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Normalize then split into a de-duplicated array of alphanumeric tokens
// (scrambled-order, case-insensitive, trimmed). Punctuation becomes a boundary.
export function normalizeTokens(input: string): string[] {
  const cleaned = normalizeText(input).replace(/[^\p{L}\p{N}\s]/gu, ' ')
  const tokens = cleaned.split(/\s+/).filter(Boolean)
  return [...new Set(tokens)]
}
