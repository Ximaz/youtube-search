// Mandatory APP_PASSWORD gate for the API surface. Public exceptions: the
// health check (used by the container healthcheck) and the session endpoints
// (login/logout/status, needed to authenticate in the first place). Pages
// handle their own redirect to the login screen.
export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/')) return
  if (path === '/api/healthz' || path.startsWith('/api/session/')) return

  if (!(await isAuthenticated(event))) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }
})
