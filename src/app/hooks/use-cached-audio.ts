import { useCallback, useEffect, useRef, useState } from "react";
import { getSongStreamUrl } from "@/api/httpClient";
import { cacheManager } from "@/service/cache";
import { useCacheStore } from "@/store/cache.store";
import { isAudioCached } from "@/store/cache-index.store";

interface CachedAudioState {
  url: string;
  isCached: boolean;
  isLoading: boolean;
}

/**
 * Resolves audio URL through the cache layer.
 * Returns cached blob URL if available, otherwise the stream URL.
 * Triggers background caching when mode != "none".
 */
export function useCachedAudioUrl(songId?: string) {
  const mode = useCacheStore((state) => state.settings.mode);
  const [state, setState] = useState<CachedAudioState>({
    url: "",
    isCached: false,
    isLoading: false,
  });
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup previous blob URL
  const revokePreviousBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!songId) {
      revokePreviousBlobUrl();
      setState({ url: "", isCached: false, isLoading: false });
      return;
    }

    if (mode === "none") {
      revokePreviousBlobUrl();
      setState({
        url: getSongStreamUrl(songId),
        isCached: false,
        isLoading: false,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, isLoading: true }));

    (async () => {
      // Check cache first
      if (isAudioCached(songId)) {
        const cachedUrl =
          await cacheManager.getCachedAudioUrl(songId);
        if (cancelled) {
          if (cachedUrl) URL.revokeObjectURL(cachedUrl);
          return;
        }

        if (cachedUrl) {
          revokePreviousBlobUrl();
          blobUrlRef.current = cachedUrl;
          setState({
            url: cachedUrl,
            isCached: true,
            isLoading: false,
          });
          return;
        }
      }

      // Not cached — use stream URL and enqueue for background caching
      if (cancelled) return;
      revokePreviousBlobUrl();
      const streamUrl = getSongStreamUrl(songId);
      setState({
        url: streamUrl,
        isCached: false,
        isLoading: false,
      });

      // Trigger background caching
      cacheManager.enqueueForCaching(songId);
    })();

    return () => {
      cancelled = true;
    };
  }, [songId, mode, revokePreviousBlobUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokePreviousBlobUrl();
    };
  }, [revokePreviousBlobUrl]);

  return state;
}
