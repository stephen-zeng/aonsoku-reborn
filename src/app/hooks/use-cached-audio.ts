import { useEffect, useRef, useState } from "react";
import { getSongStreamUrl } from "@/api/httpClient";
import { audioCache } from "@/lib/cache/audio-cache";
import { useCacheStore } from "@/store/cache.store";

const MAX_MEMORY_ENTRIES = 200;
const memoryCache = new Map<string, string>();

function memoryCacheSet(key: string, blobUrl: string) {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
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
        memoryCacheSet(songId, blobUrl);
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
