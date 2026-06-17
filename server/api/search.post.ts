import { searchVideos } from '../lib/search/buildQuery'
import { FilterSpecSchema } from '../lib/search/filterSpec'

// Runs a filter search against the LOCAL mirror only (never blocks on YouTube).
export default defineEventHandler(async (event) => {
  const spec = await readValidatedBody(event, body => FilterSpecSchema.parse(body))
  return searchVideos(spec)
})
