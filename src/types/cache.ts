export type CacheMode = "none" | "performance" | "offline";

export interface CachedItemMeta {
  id: string;
  type: "audio" | "cover";
  sizeBytes: number;
  cachedAt: number;
  lastAccessedAt: number;
}

export type SyncPhase =
  | "idle"
  | "genres"
  | "artists"
  | "playlists"
  | "albums"
  | "songs"
  | "coverArt"
  | "done"
  | "error"
  | "cancelled";

export interface SyncState {
  phase: SyncPhase;
  progress: number;
  isSyncing: boolean;
  totalItems: number;
  processedItems: number;
}

export interface CacheSettings {
  mode: CacheMode;
  maxCacheSize: number;
  syncCoverArt: boolean;
  syncOnLaunch: boolean;
}

export interface CacheStatus {
  isOnline: boolean;
  currentAudioCacheSize: number;
  currentCoverCacheSize: number;
  audioCachedCount: number;
  coverCachedCount: number;
  syncState: SyncState;
  lastSyncedAt: number | null;
}

export const CACHE_SIZE_OPTIONS = [
  { value: 536_870_912, label: "512 MB" },
  { value: 1_073_741_824, label: "1 GB" },
  { value: 2_147_483_648, label: "2 GB" },
  { value: 5_368_709_120, label: "5 GB" },
  { value: 0, label: "Unlimited" },
] as const;

export const DEFAULT_MAX_CACHE_SIZE = 2_147_483_648; // 2 GB
