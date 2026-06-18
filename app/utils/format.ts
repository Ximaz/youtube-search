// Pure display formatters, auto-imported into components and templates.
import type { ResultRow } from '~/types/search'

const nf = new Intl.NumberFormat()

export function fmtCount(n: number | null): string {
  return n == null ? '—' : nf.format(n)
}

export function fmtDuration(secs: number | null): string {
  if (secs == null) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const pad = (v: number): string => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

// UTC ISO timestamp → unambiguous, locale-aware date in the viewer's timezone
// (e.g. "18 Jun 2026" / "18 juin 2026"), avoiding the locale-ambiguous M/D/Y.
export function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'
}

// Prefer the cached S3 copy (survives YouTube deletion); else the live thumbnail.
export function thumbUrl(row: ResultRow): string {
  return row.thumbS3Key ? `/api/image/${row.thumbS3Key}` : `https://i.ytimg.com/vi/${row.id}/mqdefault.jpg`
}
