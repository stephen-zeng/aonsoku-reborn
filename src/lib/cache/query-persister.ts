import { createStore, del, get, keys, set } from "idb-keyval";
import type { Persister } from "@tanstack/query-persist-client-core";

const store = createStore("aonsoku-query-cache", "persist");

const CACHE_KEY = "tanstack-query-cache";

export function createIDBPersister(): Persister {
  return {
    persistClient: async (client) => {
      await set(CACHE_KEY, client, store);
    },
    restoreClient: async () => {
      return await get(CACHE_KEY, store);
    },
    removeClient: async () => {
      await del(CACHE_KEY, store);
    },
  };
}

export async function clearQueryCache(): Promise<void> {
  const allKeys = await keys(store);
  await Promise.all(allKeys.map((key) => del(key, store)));
}
