import { getConnectionStatus } from '../../lib/youtube/oauth'

export default defineEventHandler(async () => getConnectionStatus())
