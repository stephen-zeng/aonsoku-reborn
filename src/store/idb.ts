import type { IDBKeyvalStore } from "idb-keyval";
import { createStore, del, get, set } from "idb-keyval";
import type { PersistStorage } from "zustand/middleware";

export const cacheIndexStore = createStore("aonsoku-cache", "cache-index");
export const offlineLibraryStore = createStore(
  "aonsoku-offline",
  "offline-library",
);

let idbWriteErrorNotified = false;

function notifyIdbWriteError(operation: string, name: string, err: unknown) {
  console.error(`[idbStorage] ${operation}("${name}") failed:`, err);
  if (!idbWriteErrorNotified) {
    idbWriteErrorNotified = true;
    console.warn(
      `[idbStorage] IndexedDB write failures detected. Data may not persist across sessions. Check browser storage settings/quotas.`,
    );
  }
}

async function setWithRetry(
  name: string,
  value: unknown,
  retries = 1,
  customStore?: IDBKeyvalStore,
) {
  const writeFn = customStore
    ? () => set(name, value, customStore)
    : () => set(name, value);
  try {
    await writeFn();
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        await writeFn();
        return;
      } catch {
        // fall through to error notification
      }
    }
    notifyIdbWriteError("setItem", name, err);
  }
}

export function idbSetWithRetry(
  name: string,
  value: unknown,
  customStore: IDBKeyvalStore,
) {
  return setWithRetry(name, value, 1, customStore);
}

export const createIdbStorage = <S>(): PersistStorage<S> => ({
  getItem: (name: string) => {
    return get(name).catch((err) => {
      console.error(`[idbStorage] getItem("${name}") failed:`, err);
      return null;
    });
  },
  setItem: (name: string, value) => {
    setWithRetry(name, value);
  },
  removeItem: (name: string) => {
    del(name).catch((err) => {
      notifyIdbWriteError("removeItem", name, err);
    });
  },
});
