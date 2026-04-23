import { useCallback, useEffect, useRef, useState } from "react";
import { buildAudioUrl, cacheManager } from "@/service/cache";

interface CachedAudioState {
  url: string;
  isCached: boolean;
  isLoading: boolean;
}

export function useCachedAudioUrl(songId?: string) {
  const [state, setState] = useState<CachedAudioState>({
    url: "",
    isCached: false,
    isLoading: false,
  });
  const blobUrlRef = useRef<string | null>(null);

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

    let cancelled = false;
    setState({ url: "", isCached: false, isLoading: true });

    (async () => {
      const cachedUrl = await cacheManager.getCachedAudioUrl(songId);
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

      revokePreviousBlobUrl();
      setState({
        url: buildAudioUrl(songId, "stream"),
        isCached: false,
        isLoading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [songId, revokePreviousBlobUrl]);

  useEffect(() => {
    return () => {
      revokePreviousBlobUrl();
    };
  }, [revokePreviousBlobUrl]);

  return state;
}
