import {
  getCacheIndexActions,
  getCacheIndexItems,
  useCacheIndexStore,
} from "@/store/cache-index.store";
import type { CachedItemMeta } from "@/types/cache";
import type {
  CacheIndexAdapter,
  CacheIndexSnapshot,
  CacheItemKey,
} from "./contracts";

export const cacheIndexAdapter: CacheIndexAdapter = {
  getSnapshot(): CacheIndexSnapshot {
    const { loaded } = useCacheIndexStore.getState();
    return {
      items: { ...getCacheIndexItems() },
      loaded,
    };
  },

  getItem(key: CacheItemKey): CachedItemMeta | undefined {
    return getCacheIndexItems()[key];
  },

  hasItem(key: CacheItemKey): boolean {
    return key in getCacheIndexItems();
  },

  addItem(key: CacheItemKey, meta: CachedItemMeta): void {
    getCacheIndexActions().addItem(key, meta);
  },

  removeItem(key: CacheItemKey): void {
    getCacheIndexActions().removeItem(key);
  },

  touchItem(key: CacheItemKey): void {
    getCacheIndexActions().touchItem(key);
  },

  setRemovedFromServer(key: CacheItemKey, removed: boolean): void {
    getCacheIndexActions().setRemovedFromServer(key, removed);
  },

  clear(): void {
    getCacheIndexActions().clear();
  },

  setDownloadProgress(songId: string, progress: number): void {
    getCacheIndexActions().setDownloadProgress(songId, progress);
  },

  clearDownloadProgress(songId: string): void {
    getCacheIndexActions().clearDownloadProgress(songId);
  },
};
