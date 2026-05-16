import { isCapacitorNative } from "@/service/platform";
import type { CacheBackend } from "./types";
import { WebCacheBackend } from "./web-cache-backend";

let instance: CacheBackend | null = null;

export function getCacheBackend(): CacheBackend {
  if (instance) return instance;

  if (isCapacitorNative()) {
    // TODO: return CapacitorCacheBackend once implemented
    instance = new WebCacheBackend();
  } else {
    instance = new WebCacheBackend();
  }

  return instance;
}
