// Shapes returned by the session / YouTube-connection / sync status endpoints.

export interface SessionStatus { authenticated: boolean }

export interface ConnectionStatus { connected: boolean, channelId: string | null, tokenInvalid: boolean }

export interface SyncStatus {
  phase: string
  lastError: string | null
  lastFullSyncAt: string | null
  parked: boolean
  counts: { videos: number, videosHydrated: number, channels: number, playlists: number, subscriptions: number }
}
