import { libraryDb } from "@/store/library-db";
import type { CachedItemMeta } from "@/types/cache";
import type {
  CacheMetadataPersistence,
  CacheMetadataRecord,
} from "./contracts";

const RETRY_DELAY_MS = 200;
const MAX_RETRIES = 2;

export async function persistCacheMeta(
  key: string,
  meta: CachedItemMeta & { key: string },
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await libraryDb.cacheMeta.put(meta);
      return;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      } else {
        console.warn(
          `[cacheManager] failed to persist cacheMeta for ${key} after ${MAX_RETRIES + 1} attempts:`,
          err,
        );
      }
    }
  }
}

export async function deleteCacheMeta(key: string): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await libraryDb.cacheMeta.delete(key);
      return;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      } else {
        console.warn(
          `[cacheManager] failed to delete cacheMeta for ${key} after ${MAX_RETRIES + 1} attempts:`,
          err,
        );
      }
    }
  }
}

export async function bulkDeleteCacheMeta(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await libraryDb.cacheMeta.bulkDelete(keys);
      return;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      } else {
        console.warn(
          `[cacheManager] failed to bulkDelete cacheMeta after ${MAX_RETRIES + 1} attempts:`,
          err,
        );
      }
    }
  }
}

export const cacheMetadataPersistence: CacheMetadataPersistence = {
  get(key: string): Promise<CacheMetadataRecord | undefined> {
    return libraryDb.cacheMeta.get(key);
  },

  list(): Promise<CacheMetadataRecord[]> {
    return libraryDb.cacheMeta.toArray();
  },

  put(key: string, meta: CacheMetadataRecord): Promise<void> {
    return persistCacheMeta(key, { ...meta, key });
  },

  delete(key: string): Promise<void> {
    return deleteCacheMeta(key);
  },

  bulkDelete(keys: string[]): Promise<void> {
    return bulkDeleteCacheMeta(keys);
  },
};
