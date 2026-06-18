// Pure, locale-independent display helpers, auto-imported into components and
// templates. Locale-aware formatting (numbers, dates) lives in useI18n()
// (fmtCount, fmtDate) so it follows the chosen UI language, not the browser's.
import type { ResultRow } from '~/types/search'

export function fmtDuration(secs: number | null): string {
  if (secs == null) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (v: number): string => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// Prefer the cached S3 copy (survives YouTube deletion); else the live thumbnail.
export function thumbUrl(row: ResultRow): string {
  return row.thumbS3Key ? `/api/image/${row.thumbS3Key}` : `https://i.ytimg.com/vi/${row.id}/mqdefault.jpg`
}
