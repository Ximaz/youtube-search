// Shapes exchanged with /api/search and rendered by the search workspace.

export interface NumericInput { value: string, tolerancePct: string }

export type ImageTarget = 'thumbnail' | 'avatar'

export interface ImageMatch { phash: string, threshold: number }

export interface ResultRow {
  id: string
  title: string
  channelTitle: string | null
  publishedAt: string | null
  durationSeconds: number | null
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  deletedFromYoutube: boolean
  saved: boolean
  subscribed: boolean
  isShort: boolean | null
  thumbS3Key: string | null
}

export interface SearchResponse { total: number, results: ResultRow[] }

export interface ScanInfo { scanned: number, found: number, remaining: number, parked: boolean }
