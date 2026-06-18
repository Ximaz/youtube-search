<script setup lang="ts">
interface SessionStatus { authenticated: boolean }
interface ConnectionStatus { connected: boolean, channelId: string | null, tokenInvalid: boolean }
interface SyncStatus {
  phase: string
  lastError: string | null
  lastFullSyncAt: string | null
  parked: boolean
  counts: { videos: number, videosHydrated: number, channels: number, playlists: number, subscriptions: number }
}

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
</script>

<template>
  <main class="page">
    <h1 class="title">
      YouTube Deep-Search
    </h1>
    <p class="subtitle">
      Re-find a buried video in your own playlists &amp; likes — read-only, runs on your machine.
    </p>

    <!-- Loading -->
    <section
      v-if="appAuthed === null"
      class="card"
    >
      Loading…
    </section>

    <!-- App password gate -->
    <section
      v-else-if="!appAuthed"
      class="card"
    >
      <h2>Unlock</h2>
      <p class="muted">
        This instance is protected by your app password.
      </p>
      <form
        class="row"
        @submit.prevent="loginApp"
      >
        <input
          v-model="password"
          type="password"
          placeholder="App password"
          autocomplete="current-password"
        >
        <button
          type="submit"
          :disabled="busy || !password"
        >
          Unlock
        </button>
      </form>
      <p
        v-if="loginError"
        class="error"
      >
        {{ loginError }}
      </p>
    </section>

    <!-- Authenticated -->
    <template v-else>
      <div class="account-row">
        <section class="card">
          <div class="card-head">
            <h2>YouTube account</h2>
            <button
              class="link"
              @click="lockApp"
            >
              Lock
            </button>
          </div>

          <p
            v-if="connectError"
            class="error"
          >
            Connection error: {{ connectError }}
          </p>
          <p
            v-else-if="justConnected"
            class="ok"
          >
            ✓ Connected successfully.
          </p>

          <template v-if="connection?.connected">
            <p class="ok">
              Connected<span v-if="connection.channelId"> · channel <code>{{ connection.channelId }}</code></span>
            </p>
            <p
              v-if="connection.tokenInvalid"
              class="error"
            >
              Your access expired — please reconnect.
              <button
                class="link"
                @click="connectYouTube"
              >
                Reconnect
              </button>
            </p>
            <div class="row">
              <button
                :disabled="busy"
                @click="triggerSync"
              >
                Sync now
              </button>
              <button
                class="link"
                @click="disconnectYouTube"
              >
                Disconnect
              </button>
            </div>
          </template>

          <template v-else>
            <p class="muted">
              Connect your YouTube account with read-only access. We never modify, delete, like, or comment on anything.
            </p>
            <button @click="connectYouTube">
              Connect YouTube
            </button>
          </template>
        </section>

        <!-- Sync status -->
        <section
          v-if="sync"
          class="card"
        >
          <h2>Local mirror</h2>
          <p>
            Phase: <strong>{{ sync.phase }}</strong>
            <span
              v-if="sync.parked"
              class="warn"
            > · quota-parked (resumes after reset)</span>
          </p>
          <ul class="stats">
            <li>{{ sync.counts.videosHydrated }} / {{ sync.counts.videos }} videos</li>
            <li>{{ sync.counts.channels }} channels</li>
            <li>{{ sync.counts.playlists }} playlists</li>
            <li>{{ sync.counts.subscriptions }} subscriptions</li>
          </ul>
          <p
            v-if="sync.lastError"
            class="warn"
          >
            {{ sync.lastError }}
          </p>
          <p
            v-if="sync.lastFullSyncAt"
            class="muted"
          >
            Last full sync: {{ new Date(sync.lastFullSyncAt).toLocaleString() }}
          </p>
        </section>
      </div>

      <SearchWorkspace v-if="(sync?.counts.videos ?? 0) > 0" />
      <section
        v-else
        class="card muted"
      >
        Your library isn't mirrored yet — connect your account and run a sync, then search it here.
      </section>
    </template>
  </main>
</template>

<style scoped>
.page { max-width: 1600px; margin: 2.5rem auto; padding: 0 1rem; font-family: system-ui, sans-serif; color: #1c1c1e; }
.title { margin: 0 0 .25rem; font-size: 1.6rem; }
.subtitle { margin: 0 0 1.5rem; color: #6b6b70; }
.card { background: #fff; border: 1px solid #e5e5ea; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.account-row { display: flex; gap: 1rem; align-items: stretch; margin-bottom: 1rem; }
.account-row .card { flex: 1; min-width: 0; margin-bottom: 0; }
.card-head { display: flex; align-items: center; justify-content: space-between; }
.card h2 { margin: 0 0 .5rem; font-size: 1.05rem; }
.row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-top: .5rem; }
input { flex: 1; padding: .55rem .7rem; border: 1px solid #d0d0d5; border-radius: 8px; font-size: 1rem; }
button { padding: .55rem .9rem; border: 0; border-radius: 8px; background: #cc0000; color: #fff; font-size: .95rem; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
button.link { background: none; color: #cc0000; padding: .25rem .4rem; }
.muted { color: #6b6b70; }
.error { color: #cc0000; }
.ok { color: #1a7f37; }
.warn { color: #b26a00; }
.stats { display: flex; gap: 1.2rem; list-style: none; padding: 0; margin: .5rem 0; flex-wrap: wrap; }
code { background: #f2f2f7; padding: .1rem .3rem; border-radius: 4px; font-size: .85em; }
</style>
