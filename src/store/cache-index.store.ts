import { get } from "idb-keyval";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { audioKey, coverKey } from "@/service/cache/cache-keys";
import { cacheIndexStore, idbSetWithRetry } from "@/store/idb";
import { CachedItemMeta, CacheMetaSource } from "@/types/cache";

const IDB_KEY = "cache-index-v1";

interface CacheIndexState {
  items: Record<string, CachedItemMeta>;
  loaded: boolean;
  actions: {
    loadFromIDB: () => Promise<void>;
    addItem: (key: string, meta: CachedItemMeta) => void;
    removeItem: (key: string) => void;
    touchItem: (key: string) => void;
    clear: () => void;
  };
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let indexFlushed = false;

function schedulePersist(items: Record<string, CachedItemMeta>) {
  if (persistTimer) clearTimeout(persistTimer);
  indexFlushed = false;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    indexFlushed = true;
    idbSetWithRetry(IDB_KEY, items, cacheIndexStore);
  }, 500);
}

function flushIndexPersist() {
  if (indexFlushed) return;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  indexFlushed = true;
  const items = useCacheIndexStore.getState().items;
  idbSetWithRetry(IDB_KEY, items, cacheIndexStore);
}

function registerFlushListeners() {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const handleVisibilityChange = () => {
    if (document.hidden) flushIndexPersist();
  };
  const handleBeforeUnload = () => {
    flushIndexPersist();
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("beforeunload", handleBeforeUnload);
}
registerFlushListeners();

export const useCacheIndexStore = createWithEqualityFn<CacheIndexState>()(
  subscribeWithSelector(
    devtools(
      immer((setState, getState) => ({
        items: {},
        loaded: false,
        actions: {
          loadFromIDB: async () => {
            try {
              const stored = await get<
                Record<string, Partial<CachedItemMeta> | undefined>
              >(IDB_KEY, cacheIndexStore);
              setState((state) => {
                if (stored) {
                  // Pre-P2.1 entries lack the `source` field. Default
                  // them to "explicit" so they are treated as protected
                  // downloads, never silently evicted by LRU.
                  const migrated: Record<string, CachedItemMeta> = {};
                  for (const [key, meta] of Object.entries(stored)) {
                    if (!meta) continue;
                    migrated[key] = {
                      ...(meta as CachedItemMeta),
                      source: meta.source ?? "explicit",
                    };
                  }
                  state.items = migrated;
                }
                state.loaded = true;
              });
            } catch (err) {
              console.error("Failed to load cache index from IDB", err);
              setState((state) => {
                state.loaded = true;
              });
            }
          },
          addItem: (key, meta) => {
            setState((state) => {
              state.items[key] = meta;
            });
            schedulePersist(getState().items);
          },
          removeItem: (key) => {
            setState((state) => {
              delete state.items[key];
            });
            schedulePersist(getState().items);
          },
          touchItem: (key) => {
            setState((state) => {
              const item = state.items[key];
              if (item) {
                item.lastAccessedAt = Date.now();
              }
            });
            schedulePersist(getState().items);
          },
          clear: () => {
            setState((state) => {
              state.items = {};
            });
            schedulePersist({});
          },
        },
      })),
      { name: "cache_index_store" },
    ),
  ),
  shallow,
);

export function isAudioCached(songId: string): boolean {
  return audioKey(songId) in useCacheIndexStore.getState().items;
}

export function isCoverCached(coverArtId: string, size = "300"): boolean {
  return coverKey(coverArtId, size) in useCacheIndexStore.getState().items;
}

export function getCacheIndexItems(): Record<string, CachedItemMeta> {
  return useCacheIndexStore.getState().items;
}

export function getCacheIndexActions() {
  return useCacheIndexStore.getState().actions;
}

export const useIsAudioCached = (songId: string) =>
  useCacheIndexStore((state) => audioKey(songId) in state.items);

export const useIsCoverCached = (coverArtId: string, size = "300") =>
  useCacheIndexStore((state) => coverKey(coverArtId, size) in state.items);

export const useCacheIndexLoaded = () =>
  useCacheIndexStore((state) => state.loaded);

export const useCacheIndexActions = () =>
  useCacheIndexStore((state) => state.actions);

export interface CachePoolBreakdown {
  sizeBytes: number;
  count: number;
}

export interface CachePoolStats {
  /** Audio tagged `source: "explicit"`. */
  explicit: CachePoolBreakdown;
  /** Audio tagged `source: "smart"`. */
  smart: CachePoolBreakdown;
  /** Audio tagged `source: "lru"`. */
  lru: CachePoolBreakdown;
  /** Every `type: "cover"` entry regardless of source. */
  assets: CachePoolBreakdown;
}

function emptyBreakdown(): CachePoolBreakdown {
  return { sizeBytes: 0, count: 0 };
}

function computePoolStats(
  items: Record<string, CachedItemMeta>,
): CachePoolStats {
  const stats: CachePoolStats = {
    explicit: emptyBreakdown(),
    smart: emptyBreakdown(),
    lru: emptyBreakdown(),
    assets: emptyBreakdown(),
  };
  for (const meta of Object.values(items)) {
    if (meta.type === "cover") {
      stats.assets.sizeBytes += meta.sizeBytes;
      stats.assets.count += 1;
      continue;
    }
    const bucket = poolForAudioSource(meta.source);
    stats[bucket].sizeBytes += meta.sizeBytes;
    stats[bucket].count += 1;
  }
  return stats;
}

function poolForAudioSource(source: CacheMetaSource): keyof CachePoolStats {
  switch (source) {
    case "explicit":
      return "explicit";
    case "smart":
      return "smart";
    case "lru":
      return "lru";
  }
}

/**
 * Aggregated cache stats grouped by pool for the storage settings UI.
 * Computed on every change to the cache index — cheap because the
 * index tracks O(hundreds) of entries even with a large library.
 */
export const useCachePoolStats = (): CachePoolStats =>
  useCacheIndexStore((state) => computePoolStats(state.items), shallow);
