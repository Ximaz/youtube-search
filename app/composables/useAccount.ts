// Landing-page state: app-password unlock, YouTube connection status and the
// local-mirror sync status (polled every 2.5s while unlocked).
import type { ConnectionStatus, SessionStatus, SyncStatus } from '~/types/account'

export function useAccount() {
  const route = useRoute()

  const appAuthed = ref<boolean | null>(null)
  const password = ref('')
  const loginError = ref<string | null>(null)
  const connection = ref<ConnectionStatus | null>(null)
  const sync = ref<SyncStatus | null>(null)
  const busy = ref(false)

  const connectError = computed(() => {
    const e = route.query.connect_error
    return typeof e === 'string' ? e : null
  })
  const justConnected = computed(() => route.query.connected === '1')

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function refreshConnection(): Promise<void> {
    connection.value = await $fetch<ConnectionStatus>('/api/auth/status')
  }

  async function refreshSync(): Promise<void> {
    sync.value = await $fetch<SyncStatus>('/api/sync/status')
  }

  async function loadAll(): Promise<void> {
    await Promise.all([refreshConnection(), refreshSync()])
  }

  async function loginApp(): Promise<void> {
    loginError.value = null
    busy.value = true
    try {
      await $fetch('/api/session/login', { method: 'POST', body: { password: password.value } })
      appAuthed.value = true
      password.value = ''
      await loadAll()
      startPolling()
    }
    catch {
      loginError.value = 'Invalid password.'
    }
    finally {
      busy.value = false
    }
  }

  async function lockApp(): Promise<void> {
    await $fetch('/api/session/logout', { method: 'POST' })
    appAuthed.value = false
    stopPolling()
  }

  function connectYouTube(): void {
    window.location.href = '/api/auth/login'
  }

  async function disconnectYouTube(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await refreshConnection()
  }

  async function triggerSync(): Promise<void> {
    busy.value = true
    try {
      await $fetch('/api/sync/trigger', { method: 'POST' })
      await refreshSync()
    }
    finally {
      busy.value = false
    }
  }

  function startPolling(): void {
    stopPolling()
    pollTimer = setInterval(() => {
      if (appAuthed.value) void refreshSync()
    }, 2500)
  }
  function stopPolling(): void {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  onMounted(async () => {
    const status = await $fetch<SessionStatus>('/api/session/status')
    appAuthed.value = status.authenticated
    if (status.authenticated) {
      await loadAll()
      startPolling()
    }
  })
  onBeforeUnmount(stopPolling)

  return {
    appAuthed,
    password,
    loginError,
    connection,
    sync,
    busy,
    connectError,
    justConnected,
    loginApp,
    lockApp,
    connectYouTube,
    disconnectYouTube,
    triggerSync,
  }
}
