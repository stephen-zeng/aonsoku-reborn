export type DownloadQuality = "stream" | "original";

/**
 * Why a cached item exists. Determines eviction eligibility:
 *
 *  - "explicit" — user pressed "Download" on a song / album / playlist.
 *    Never auto-evicted; only removed by explicit user action.
 *  - "smart"    — a smart-download rule (P5) matched the item. Evicted
 *    the moment no rule still matches it.
 *  - "lru"      — opportunistically cached by playback or queue
 *    prefetch. Evicted oldest-first when the LRU pool is over quota.
 */
export type CacheMetaSource = "explicit" | "smart" | "lru";

export interface CachedItemMeta {
  id: string;
  type: "audio" | "cover";
  source: CacheMetaSource;
  /**
   * Rule names (smart-download only) that currently keep this item
   * cached. Cleared when the last rule stops matching, at which point
   * the entry is evicted.
   */
  triggers?: string[];
  quality?: DownloadQuality;
  sizeBytes: number;
  cachedAt: number;
  lastAccessedAt: number;
  /**
   * True when a synced explicit download no longer exists on the
   * server (P7.3). The local blob is kept so offline playback stays
   * working, but the UI labels it as "removed from server".
   */
  removedFromServer?: boolean;
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
  downloadQuality: DownloadQuality;
  maxCacheSize: number;
  syncLibrary: boolean;
  syncCoverArt: boolean;
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

export const DEFAULT_MAX_CACHE_SIZE = 2_147_483_648;
