import { useCallback, useState } from "react";
import { audioKey, cacheManager } from "@/service/cache";
import {
  useDownloadProgress,
  useIsAudioCached,
} from "@/store/cache-index.store";

interface UseSongCacheStateResult {
  isCached: boolean;
  isLoading: boolean;
  progress?: number;
  cache: () => Promise<void>;
  remove: () => Promise<void>;
}

export function useSongCacheState(songId: string): UseSongCacheStateResult {
  const isCached = useIsAudioCached(songId);
  const progress = useDownloadProgress(songId);
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  const isLoading = isLocalLoading || progress !== undefined;

  const cache = useCallback(async () => {
    if (isCached || isLoading) return;
    setIsLocalLoading(true);
    try {
      await cacheManager.cacheSong(songId);
    } finally {
      setIsLocalLoading(false);
    }
  }, [songId, isCached, isLoading]);

  const remove = useCallback(async () => {
    if (!isCached) return;
    setIsLocalLoading(true);
    try {
      await cacheManager.evictItem(audioKey(songId));
    } finally {
      setIsLocalLoading(false);
    }
  }, [songId, isCached]);

  return { isCached, isLoading, progress, cache, remove };
}
