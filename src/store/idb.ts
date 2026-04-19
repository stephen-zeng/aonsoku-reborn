import { createStore, del, get, set } from "idb-keyval";
import type { PersistStorage } from "zustand/middleware";

export const cacheIndexStore = createStore("aonsoku-cache", "cache-index");
export const offlineLibraryStore = createStore(
  "aonsoku-offline",
  "offline-library",
);

export const createIdbStorage = <S>(): PersistStorage<S> => ({
  getItem: (name: string) => {
    return get(name).catch((err) => {
      console.error(`[idbStorage] getItem("${name}") failed:`, err);
      return null;
    });
  },
  setItem: (name: string, value) => {
    set(name, value).catch((err) => {
      console.error(`[idbStorage] setItem("${name}") failed:`, err);
    });
  },
  removeItem: (name: string) => {
    del(name).catch((err) => {
      console.error(`[idbStorage] removeItem("${name}") failed:`, err);
    });
  },
});