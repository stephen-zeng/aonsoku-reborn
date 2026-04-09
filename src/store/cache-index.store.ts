import { get, set } from "idb-keyval";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { audioKey, coverKey } from "@/service/cache/cache-keys";
import { cacheIndexStore } from "@/store/idb";
import { CachedItemMeta } from "@/types/cache";

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

function schedulePersist(
  items: Record<string, CachedItemMeta>,
) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    set(IDB_KEY, items, cacheIndexStore).catch((err) => {
      console.error(
        "Failed to persist cache index to IDB",
        err,
      );
    });
  }, 500);
}

export const useCacheIndexStore =
  createWithEqualityFn<CacheIndexState>()(
    subscribeWithSelector(
      devtools(
        immer((setState, getState) => ({
          items: {},
          loaded: false,
          actions: {
            loadFromIDB: async () => {
              try {
                const stored = await get<
                  Record<string, CachedItemMeta>
                >(IDB_KEY, cacheIndexStore);
                setState((state) => {
                  if (stored) state.items = stored;
                  state.loaded = true;
                });
              } catch (err) {
                console.error(
                  "Failed to load cache index from IDB",
                  err,
                );
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

// Helper functions (non-hook, for use in services)
export function isAudioCached(songId: string): boolean {
  return (
    audioKey(songId) in
    useCacheIndexStore.getState().items
  );
}

export function isCoverCached(
  coverArtId: string,
  size = "300",
): boolean {
  return (
    coverKey(coverArtId, size) in
    useCacheIndexStore.getState().items
  );
}

export function getCacheIndexItems(): Record<
  string,
  CachedItemMeta
> {
  return useCacheIndexStore.getState().items;
}

export function getCacheIndexActions() {
  return useCacheIndexStore.getState().actions;
}

// Selective hooks
export const useIsAudioCached = (songId: string) =>
  useCacheIndexStore(
    (state) => audioKey(songId) in state.items,
  );

export const useIsCoverCached = (
  coverArtId: string,
  size = "300",
) =>
  useCacheIndexStore(
    (state) => coverKey(coverArtId, size) in state.items,
  );

export const useCacheIndexLoaded = () =>
  useCacheIndexStore((state) => state.loaded);

export const useCacheIndexActions = () =>
  useCacheIndexStore((state) => state.actions);
