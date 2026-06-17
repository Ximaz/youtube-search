import { getObjectBytes } from '../../lib/storage'

// Serves cached thumbnails/avatars from S3 so they remain visible even after a
// video is deleted from YouTube (the deletion safety net).
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  if (!key || (!key.startsWith('thumbs/') && !key.startsWith('avatars/'))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image key' })
  }
  try {
    const { body, contentType } = await getObjectBytes(key)
    setResponseHeader(event, 'content-type', contentType ?? 'image/jpeg')
    setResponseHeader(event, 'cache-control', 'private, max-age=86400')
    return body
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: 'Image not found' })
  }
})
