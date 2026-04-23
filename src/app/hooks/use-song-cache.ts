import { useCallback, useState } from "react";
import { audioKey, cacheManager } from "@/service/cache";
import { useIsAudioCached } from "@/store/cache-index.store";

interface UseSongCacheStateResult {
  isCached: boolean;
  isLoading: boolean;
  cache: () => Promise<void>;
  remove: () => Promise<void>;
}

export function useSongCacheState(songId: string): UseSongCacheStateResult {
  const isCached = useIsAudioCached(songId);
  const [isLoading, setIsLoading] = useState(false);

  const cache = useCallback(async () => {
    if (isCached) return;
    setIsLoading(true);
    try {
      await cacheManager.cacheSong(songId);
    } finally {
      setIsLoading(false);
    }
  }, [songId, isCached]);

  const remove = useCallback(async () => {
    if (!isCached) return;
    setIsLoading(true);
    try {
      await cacheManager.evictItem(audioKey(songId));
    } finally {
      setIsLoading(false);
    }
  }, [songId, isCached]);

  return { isCached, isLoading, cache, remove };
}
