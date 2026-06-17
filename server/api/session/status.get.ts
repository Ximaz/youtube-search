export default defineEventHandler(async event => ({
  authenticated: await isAuthenticated(event),
}))
