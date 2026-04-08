import { useEffect, useRef, useState } from "react";
import { getCoverArtUrl } from "@/api/httpClient";
import { coverArtCache } from "@/lib/cache/cover-art-cache";
import { useCacheStore } from "@/store/cache.store";
import { CoverArt } from "@/types/coverArtType";

// In-memory LRU to avoid repeated IDB reads within the same session
const memoryCache = new Map<string, string>();
const MAX_MEMORY_ENTRIES = 500;

function memoryCacheSet(key: string, blobUrl: string) {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // Remove oldest entry
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) {
      const oldUrl = memoryCache.get(firstKey);
      if (oldUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(oldUrl);
      }
      memoryCache.delete(firstKey);
    }
  }
  memoryCache.set(key, blobUrl);
}

export function useCachedCoverArt(
  id: string | undefined,
  type: CoverArt = "album",
  size = "300",
): string {
  const enabled = useCacheStore((state) => state.settings.coverArtCacheEnabled);
  const originalUrl = getCoverArtUrl(id, type, size);
  const [src, setSrc] = useState<string>(() => {
    if (!id || !enabled) return originalUrl;

    const key = `${type}:${id}:${size}`;
    const cached = memoryCache.get(key);
    return cached ?? originalUrl;
  });
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id || !enabled) {
      setSrc(originalUrl);
      return;
    }

    const key = `${type}:${id}:${size}`;

    // Check memory cache first
    const memoryCached = memoryCache.get(key);
    if (memoryCached) {
      setSrc(memoryCached);
      return;
    }

    let cancelled = false;

    coverArtCache.getBlob(id, type, size).then((blob) => {
      if (cancelled) return;

      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        memoryCacheSet(key, blobUrl);
        setSrc(blobUrl);
      } else {
        setSrc(originalUrl);
        coverArtCache.putBlob(id, type, size, originalUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, type, size, enabled, originalUrl]);

  return src;
}
