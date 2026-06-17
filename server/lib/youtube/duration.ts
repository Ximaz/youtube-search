// ISO 8601 duration (PnYnMnDTnHnMnS). Real videos only use PT#H#M#S, but we
// parse weeks/days defensively. Live/upcoming streams return P0D / PT0S → 0.
const ISO_DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

export function parseIsoDurationToSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null
  const m = ISO_DURATION.exec(iso)
  if (!m) return null
  const n = (v: string | undefined) => (v === undefined ? 0 : Number(v))
  const [, years, months, weeks, days, hours, minutes, seconds] = m
  return Math.round(
    n(years) * 31_536_000
    + n(months) * 2_592_000
    + n(weeks) * 604_800
    + n(days) * 86_400
    + n(hours) * 3600
    + n(minutes) * 60
    + n(seconds),
  )
}

// seconds → "H:MM:SS" / "M:SS" for display.
export function secondsToHms(total: number): string {
  const t = Math.max(0, Math.floor(total))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const pad = (v: number) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// "HH:MM:SS" | "MM:SS" | "SS" → seconds (the duration filter input format).
// Returns null for malformed input.
export function hmsToSeconds(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const parts = trimmed.split(':').map(p => p.trim())
  if (parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null
  const nums = parts.map(Number)
  // Minutes/seconds components must be < 60 (base-60, not base-100).
  const tail = nums.slice(1)
  if (tail.some(v => v >= 60)) return null
  return nums.reduce((acc, v) => acc * 60 + v, 0)
}
