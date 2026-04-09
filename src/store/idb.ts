import { createStore, del, get, set } from "idb-keyval";

export const cacheIndexStore = createStore(
  "aonsoku-cache",
  "cache-index",
);
export const offlineLibraryStore = createStore(
  "aonsoku-cache",
  "offline-library",
);

export const idbStorage = {
  getItem: <T>(name: string, callback: (value: T | null) => void): void => {
    get<T>(name)
      .then((value) => {
        callback(value ?? null);
      })
      .catch(() => {
        callback(null);
      });
  },
  setItem: (name: string, value: unknown, callback?: () => void): void => {
    set(name, value)
      .then(() => callback?.())
      .catch(() => callback?.());
  },
  removeItem: (name: string, callback?: () => void): void => {
    del(name)
      .then(() => callback?.())
      .catch(() => callback?.());
  },
};
