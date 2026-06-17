import { fetchImageBytes, isAllowedImageUrl } from '../lib/image/fetch'
import { hashViaWorker } from '../lib/image/hashClient'

// Accepts a multipart file upload OR a JSON { url }, returns the 64-bit pHash to
// drop into a thumbnail/channelAvatar filter. Hashing is delegated to the worker
// (keeps native sharp out of the web server).
const MAX_IMAGE_BYTES = 12 * 1024 * 1024 // 12 MB

export default defineEventHandler(async (event) => {
  const contentType = getHeader(event, 'content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const file = parts?.find(part => part.filename && part.data.length > 0)
    if (!file) throw createError({ statusCode: 400, statusMessage: 'No image file provided' })
    if (file.data.length > MAX_IMAGE_BYTES) throw createError({ statusCode: 413, statusMessage: 'Image too large' })
    return { phash: await hashViaWorker(file.data) }
  }

  const body = await readBody<{ url?: string }>(event)
  if (!body?.url) throw createError({ statusCode: 400, statusMessage: 'Provide an image file or a url' })
  // SSRF guard — refuse internal/loopback/metadata hosts.
  if (!isAllowedImageUrl(body.url)) throw createError({ statusCode: 400, statusMessage: 'That image URL is not allowed' })
  const bytes = await fetchImageBytes(body.url)
  if (!bytes) throw createError({ statusCode: 422, statusMessage: 'Could not fetch that image URL' })
  if (bytes.length > MAX_IMAGE_BYTES) throw createError({ statusCode: 413, statusMessage: 'Image too large' })
  return { phash: await hashViaWorker(bytes) }
})
