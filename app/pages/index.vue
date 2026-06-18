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
const { t, tc, fmtDate } = useI18n()
</script>

<template>
  <main class="page">
    <div class="topbar">
      <LanguageSwitcher />
    </div>
    <h1 class="title">
      {{ t('app.title') }}
    </h1>
    <p class="subtitle">
      {{ t('app.subtitle') }}
    </p>

    <!-- Loading -->
    <section
      v-if="appAuthed === null"
      class="card"
    >
      {{ t('common.loading') }}
    </section>

    <!-- App password gate -->
    <section
      v-else-if="!appAuthed"
      class="card"
    >
      <h2>{{ t('account.unlockTitle') }}</h2>
      <p class="muted">
        {{ t('account.protected') }}
      </p>
      <form
        class="row"
        @submit.prevent="loginApp"
      >
        <input
          v-model="password"
          type="password"
          :placeholder="t('account.passwordPlaceholder')"
          autocomplete="current-password"
        >
        <button
          type="submit"
          :disabled="busy || !password"
        >
          {{ t('account.unlock') }}
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
            <h2>{{ t('account.youtubeAccount') }}</h2>
            <button
              class="link"
              @click="lockApp"
            >
              {{ t('account.lock') }}
            </button>
          </div>

          <p
            v-if="connectError"
            class="error"
          >
            {{ t('account.connectionError', { error: connectError ?? '' }) }}
          </p>
          <p
            v-else-if="justConnected"
            class="ok"
          >
            {{ t('account.connectedSuccess') }}
          </p>

          <template v-if="connection?.connected">
            <p class="ok">
              {{ t('account.connected') }}<span v-if="connection.channelId"> · {{ t('account.channel') }} <code>{{ connection.channelId }}</code></span>
            </p>
            <p
              v-if="connection.tokenInvalid"
              class="error"
            >
              {{ t('account.accessExpired') }}
              <button
                class="link"
                @click="connectYouTube"
              >
                {{ t('account.reconnect') }}
              </button>
            </p>
            <div class="row">
              <button
                :disabled="busy"
                @click="triggerSync"
              >
                {{ t('account.syncNow') }}
              </button>
              <button
                class="link"
                @click="disconnectYouTube"
              >
                {{ t('account.disconnect') }}
              </button>
            </div>
          </template>

          <template v-else>
            <p class="muted">
              {{ t('account.connectBlurb') }}
            </p>
            <button @click="connectYouTube">
              {{ t('account.connectYoutube') }}
            </button>
          </template>
        </section>

        <!-- Sync status -->
        <section
          v-if="sync"
          class="card"
        >
          <h2>{{ t('mirror.title') }}</h2>
          <p>
            {{ t('mirror.phaseLabel') }} <strong>{{ t(`mirror.phases.${sync.phase}`) }}</strong>
            <span
              v-if="sync.parked"
              class="warn"
            >{{ t('mirror.quotaParked') }}</span>
          </p>
          <ul class="stats">
            <li>{{ sync.counts.videosHydrated }} / {{ sync.counts.videos }} {{ tc('mirror.videosNoun', sync.counts.videos) }}</li>
            <li>{{ sync.counts.channels }} {{ tc('mirror.channelsNoun', sync.counts.channels) }}</li>
            <li>{{ sync.counts.playlists }} {{ tc('mirror.playlistsNoun', sync.counts.playlists) }}</li>
            <li>{{ sync.counts.subscriptions }} {{ tc('mirror.subscriptionsNoun', sync.counts.subscriptions) }}</li>
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
            {{ t('mirror.lastSync', { date: fmtDate(sync.lastFullSyncAt) }) }}
          </p>
        </section>
      </div>

      <SearchWorkspace v-if="(sync?.counts.videos ?? 0) > 0" />
      <section
        v-else
        class="card muted"
      >
        {{ t('mirror.empty') }}
      </section>
    </template>
  </main>
</template>

<style scoped src="./index.css"></style>
