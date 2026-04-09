import { useEffect, useRef, useState } from "react";
import { getSongStreamUrl } from "@/api/httpClient";
import { audioCache } from "@/lib/cache/audio-cache";
import { MemoryLRUCache } from "@/lib/cache/memory-lru-cache";
import { useCacheStore } from "@/store/cache.store";

const memoryCache = new MemoryLRUCache(200);

export function useCachedAudio(songId: string | undefined): string {
  const enabled = useCacheStore((state) => state.settings.audioCacheEnabled);
  const maxSize = useCacheStore((state) => state.settings.audioCacheMaxSize);
  const originalUrl = songId ? getSongStreamUrl(songId) : "";
  const [src, setSrc] = useState<string>(() => {
    if (!songId || !enabled) return originalUrl;

    const cached = memoryCache.get(songId);
    return cached ?? originalUrl;
  });
  const prevSongIdRef = useRef<string | undefined>(songId);

  useEffect(() => {
    if (!songId) {
      setSrc("");
      return;
    }

    if (!enabled) {
      setSrc(originalUrl);
      return;
    }

    prevSongIdRef.current = songId;

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
      } else {
        setSrc(originalUrl);
        audioCache.putBlob(songId, originalUrl, maxSize);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [songId, enabled, originalUrl, maxSize]);

  return src;
}
