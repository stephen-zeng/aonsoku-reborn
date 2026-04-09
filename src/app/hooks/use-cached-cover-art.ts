import { useEffect, useState } from "react";
import { getCoverArtUrl } from "@/api/httpClient";
import {
  coverArtCache,
  normalizeSize,
} from "@/lib/cache/cover-art-cache";
import { MemoryLRUCache } from "@/lib/cache/memory-lru-cache";
import { useCacheStore } from "@/store/cache.store";
import { useIsOffline } from "@/store/offline.store";
import { useAppData } from "@/store/app.store";
import { CoverArt } from "@/types/coverArtType";

// In-memory LRU to avoid repeated IDB reads within the same session
const memoryCache = new MemoryLRUCache(500);

/** Clear the in-memory layer. Call when disabling the cache or logging out. */
export function clearCoverArtMemoryCache(): void {
  memoryCache.clear();
}

export function useCachedCoverArt(
  id: string | undefined,
  type: CoverArt = "album",
  size = "300",
): string {
  const enabled = useCacheStore((state) => state.settings.coverArtCacheEnabled);
  const isOfflineMode = useIsOffline();

  // Track scope changes so we don't serve stale entries after a server switch
  const { url: serverUrl, username } = useAppData();

  const fallbackUrl = getCoverArtUrl(undefined, type, size);
  const originalUrl = getCoverArtUrl(id, type, size);

  // Canonical size used for cache key construction
  const canonicalSize = normalizeSize(size);

  const scope = `${serverUrl}|${username}`;
  // IDB key has no type — use scope|id|size so memory and IDB keys align
  const memKey = `${scope}|${id}|${canonicalSize}`;

  const [src, setSrc] = useState<string>(() => {
    if (!id) return fallbackUrl;
    if (!enabled) return isOfflineMode ? fallbackUrl : originalUrl;
    const cached = memoryCache.get(memKey);
    return cached ?? (isOfflineMode ? fallbackUrl : originalUrl);
  });

  useEffect(() => {
    if (!id || !enabled) {
      setSrc(id ? (isOfflineMode ? fallbackUrl : originalUrl) : fallbackUrl);
      return;
    }

    // Check memory cache first (also promotes to MRU)
    const memoryCached = memoryCache.get(memKey);
    if (memoryCached) {
      setSrc(memoryCached);
      return;
    }

    let cancelled = false;
    // Track any blob URL we create so we can revoke it on cleanup
    let ownedBlobUrl: string | null = null;

    function storeBlobUrl(blobUrl: string) {
      ownedBlobUrl = blobUrl;
      memoryCache.set(memKey, blobUrl);
      setSrc(blobUrl);
    }

    async function load() {
      // 1. Exact size hit in IDB
      const exactBlob = await coverArtCache.getBlob(scope, id!, canonicalSize);

      if (cancelled) return;

      if (exactBlob) {
        storeBlobUrl(URL.createObjectURL(exactBlob));
        return;
      }

      // 2. Offline: try best available size for this id (cross-size fallback)
      if (isOfflineMode) {
        const bestBlob = await coverArtCache.getBestAvailableBlob(scope, id!);
        if (cancelled) return;

        if (bestBlob) {
          storeBlobUrl(URL.createObjectURL(bestBlob));
        } else {
          setSrc(fallbackUrl);
        }
        return;
      }

      // 3. Online: show originalUrl immediately, then download and cache
      setSrc(originalUrl);

      // putBlob handles pre-existence check + single-flight internally
      // and returns the blob directly — no need for a second getBlob call
      const newBlob = await coverArtCache.putBlob(
        scope,
        id!,
        canonicalSize,
        // Use the canonical size URL for the actual download
        getCoverArtUrl(id, type, canonicalSize),
      );

      if (!cancelled && newBlob) {
        storeBlobUrl(URL.createObjectURL(newBlob));
      }
    }

    load().catch(() => {
      if (!cancelled) setSrc(isOfflineMode ? fallbackUrl : originalUrl);
    });

    return () => {
      cancelled = true;
      // Revoke blob URL only if memory cache no longer holds this entry
      // (i.e. it was evicted). If still in cache, the cache owns the URL.
      if (ownedBlobUrl && memoryCache.get(memKey) !== ownedBlobUrl) {
        URL.revokeObjectURL(ownedBlobUrl);
      }
    };
  }, [
    id,
    type,
    canonicalSize,
    enabled,
    isOfflineMode,
    scope,
    memKey,
    fallbackUrl,
    originalUrl,
  ]);

  return src;
}
