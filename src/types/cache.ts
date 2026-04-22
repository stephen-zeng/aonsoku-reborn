export type DownloadQuality = "original" | "high" | "medium" | "low";

/** Bitrate cap (kbps) passed to the Subsonic stream endpoint. 0 = raw. */
export const QUALITY_MAX_BITRATE: Record<DownloadQuality, number> = {
  original: 0,
  high: 320,
  medium: 192,
  low: 128,
};

export const DOWNLOAD_QUALITIES: DownloadQuality[] = [
  "original",
  "high",
  "medium",
  "low",
];

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

export interface SmartRuleSettings {
  /** Master switch — when false the engine does nothing. */
  enabled: boolean;
  favoriteSongs: boolean;
  favoritePlaylists: boolean;
  frequentPlays: boolean;
  /** Min playCount to qualify for the "frequently played" rule. */
  frequentPlaysThreshold: number;
  recentPlays: boolean;
  /** Trailing days for the "recently played" rule. */
  recentPlaysDays: number;
}

export const DEFAULT_SMART_RULES: SmartRuleSettings = {
  enabled: false,
  favoriteSongs: true,
  favoritePlaylists: true,
  frequentPlays: true,
  frequentPlaysThreshold: 5,
  recentPlays: true,
  recentPlaysDays: 14,
};

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
  /** For cover entries: the resolution (e.g. "700") that was requested. */
  coverSize?: string;
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
  /** Quality for cached/downloaded audio (cacheSong path). */
  downloadQuality: DownloadQuality;
  /** Quality for streaming playback (not cached). */
  streamQuality: DownloadQuality;
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
  /** P5: automatic-download rules. */
  smartRules: SmartRuleSettings;
  libraryCaching: boolean;
  syncLibrary: boolean;
  syncCoverArt: boolean;
}

export interface CacheStatus {
  isOnline: boolean;
  /**
   * True when the current connection looks expensive or slow
   * (Network Information API: `saveData=true`, `type=cellular`, or
   * `effectiveType` ∈ {slow-2g, 2g, 3g}). Background sync and the
   * smart-download engine back off when this is true; user-initiated
   * downloads are unaffected. Always false on browsers that don't
   * expose the Network Information API.
   */
  isMetered: boolean;
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
