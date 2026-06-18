<script setup lang="ts">
const {
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
} = useAccount()
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
            Last full sync: {{ fmtDate(sync.lastFullSyncAt) }}
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

<style scoped src="./index.css"></style>
