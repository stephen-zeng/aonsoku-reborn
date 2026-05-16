import type { CacheBackend } from "./types";
import { cacheStorage } from "../cache-storage";

export class WebCacheBackend implements CacheBackend {
  put(key: string, data: Blob, contentType: string): Promise<void> {
    return cacheStorage.put(key, data, contentType);
  }

  get(key: string): Promise<Blob | null> {
    return cacheStorage.get(key);
  }

  delete(key: string): Promise<boolean> {
    return cacheStorage.delete(key);
  }

  has(key: string): Promise<boolean> {
    return cacheStorage.has(key);
  }

  clear(): Promise<void> {
    return cacheStorage.clear();
  }

  keys(): Promise<string[]> {
    return cacheStorage.keys();
  }
}
