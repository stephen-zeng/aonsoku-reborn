import { useEffect, useState } from "react";
import { getSongStreamUrl } from "@/api/httpClient";
import { audioCache } from "@/lib/cache/audio-cache";
import { MemoryLRUCache } from "@/lib/cache/memory-lru-cache";
import { useCacheStore } from "@/store/cache.store";
import { useIsOffline } from "@/store/offline.store";

const memoryCache = new MemoryLRUCache(200);

export function useCachedAudio(songId: string | undefined): string {
  const enabled = useCacheStore((state) => state.settings.audioCacheEnabled);
  const maxSize = useCacheStore((state) => state.settings.audioCacheMaxSize);
  const isOfflineMode = useIsOffline();
  const originalUrl = songId ? getSongStreamUrl(songId) : "";
  const [src, setSrc] = useState<string>(() => {
    if (!songId) return "";
    if (!enabled) return isOfflineMode ? "" : originalUrl;

    const cached = memoryCache.get(songId);
    return cached ?? (isOfflineMode ? "" : originalUrl);
  });

  useEffect(() => {
    if (!songId) {
      setSrc("");
      return;
    }

    if (!enabled) {
      setSrc(isOfflineMode ? "" : originalUrl);
      return;
    }

    const memoryCached = memoryCache.get(songId);
    if (memoryCached) {
      setSrc(memoryCached);
      return;
    }

    let cancelled = false;

    audioCache.getBlob(songId).then((blob) => {
      if (cancelled) return;

      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        memoryCache.set(songId, blobUrl);
        setSrc(blobUrl);
      } else if (isOfflineMode) {
        setSrc("");
      } else {
        setSrc(originalUrl);
        audioCache.putBlob(songId, originalUrl, maxSize);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [songId, enabled, isOfflineMode, originalUrl, maxSize]);

  return src;
}
