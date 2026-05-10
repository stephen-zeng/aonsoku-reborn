import { useIsAudioCached } from "@/store/cache-index.store";
import { useIsOfflineMode } from "@/store/cache.store";

/**
 * Determines whether a song is playable in the current context.
 * When in offline mode, only cached songs are available.
 */
export function useSongAvailability(songId: string) {
  const isOfflineMode = useIsOfflineMode();
  const isCached = useIsAudioCached(songId);

  return {
    isAvailable: !isOfflineMode || isCached,
    isCached,
    isOfflineMode,
  };
}
