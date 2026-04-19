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

export type SyncTier = "t1" | "t2" | "t3";

export type SyncPhase =
  | "idle"
  | "genres"
  | "artists"
  | "playlists"
  | "albums"
  | "songs"
  | "favorites"
  | "coverArt"
  | "done"
  | "error"
  | "cancelled";

export interface SyncState {
  phase: SyncPhase;
  /** Which tier is currently running, if any. */
  tier?: SyncTier;
  progress: number;
  isSyncing: boolean;
  totalItems: number;
  processedItems: number;
}

export interface CacheSettings {
  downloadQuality: DownloadQuality;
  /**
   * @deprecated Replaced by `assetsQuota` + `lruQuota` + `smartQuota`
   * in P2.3. Kept in the type so the cache-store migration can read
   * the old value one time; new code must consume the per-pool quotas.
   */
  maxCacheSize: number;
  /** Cap for L2 resources: cover art (and lyrics once P7.2 lands). */
  assetsQuota: number;
  /** Cap for the LRU audio pool (implicit playback/queue prefetch). */
  lruQuota: number;
  /** Cap for the smart-download audio pool. */
  smartQuota: number;
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

/**
 * Quota options shared by every per-pool selector. `0` is rendered
 * as "Unlimited".
 */
export const CACHE_SIZE_OPTIONS = [
  { value: 268_435_456, label: "256 MB" },
  { value: 536_870_912, label: "512 MB" },
  { value: 1_073_741_824, label: "1 GB" },
  { value: 2_147_483_648, label: "2 GB" },
  { value: 3_221_225_472, label: "3 GB" },
  { value: 5_368_709_120, label: "5 GB" },
  { value: 0, label: "Unlimited" },
] as const;

/** Legacy single-cap default. Still exported for backwards compat. */
export const DEFAULT_MAX_CACHE_SIZE = 2_147_483_648; // 2 GB
export const DEFAULT_ASSETS_QUOTA = 536_870_912; // 512 MB
export const DEFAULT_LRU_QUOTA = 1_073_741_824; // 1 GB
export const DEFAULT_SMART_QUOTA = 3_221_225_472; // 3 GB
