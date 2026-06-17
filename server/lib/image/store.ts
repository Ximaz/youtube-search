import { putObject } from '../storage'
import { fetchImageBytes } from './fetch'
import { computePhash } from './hash'

// Best-resolution-first thumbnail candidates for a video id. maxres/sd 404 when
// not available; hqdefault always exists for a live video.
const THUMB_CANDIDATES: { res: string, file: string }[] = [
  { res: 'maxres', file: 'maxresdefault.jpg' },
  { res: 'standard', file: 'sddefault.jpg' },
  { res: 'high', file: 'hqdefault.jpg' },
  { res: 'medium', file: 'mqdefault.jpg' },
]

export interface StoredImage {
  phash: string
  s3Key: string
  resolution: string
}

// Fetch the best available thumbnail, hash it, and store it to S3.
export async function processVideoThumbnail(videoId: string): Promise<StoredImage | null> {
  for (const { res, file } of THUMB_CANDIDATES) {
    const bytes = await fetchImageBytes(`https://i.ytimg.com/vi/${videoId}/${file}`)
    if (!bytes) continue
    const phash = await computePhash(bytes)
    const s3Key = `thumbs/${videoId}.jpg`
    await putObject(s3Key, bytes, 'image/jpeg')
    return { phash, s3Key, resolution: res }
  }
  return null
}

// Fetch/hash/store an arbitrary image URL (used for channel avatars).
export async function processImageUrl(url: string, s3Key: string): Promise<StoredImage | null> {
  const bytes = await fetchImageBytes(url)
  if (!bytes) return null
  const phash = await computePhash(bytes)
  await putObject(s3Key, bytes, 'image/jpeg')
  return { phash, s3Key, resolution: 'source' }
}
