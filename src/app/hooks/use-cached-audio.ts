import { useCallback, useEffect, useRef, useState } from "react";
import { buildAudioUrl, cacheManager } from "@/service/cache";

interface CachedAudioState {
  url: string;
  resolvedSongId: string | undefined;
  isCached: boolean;
  isLoading: boolean;
}

const INITIAL_STATE: CachedAudioState = {
  url: "",
  resolvedSongId: undefined,
  isCached: false,
  isLoading: false,
};

export function useCachedAudioUrl(songId?: string) {
  const [state, setState] = useState<CachedAudioState>(INITIAL_STATE);
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
      setState({
        url: "",
        resolvedSongId: undefined,
        isCached: false,
        isLoading: false,
      });
      return;
    }

    let cancelled = false;

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
          resolvedSongId: songId,
          isCached: true,
          isLoading: false,
        });
        return;
      }

      revokePreviousBlobUrl();
      setState({
        url: buildAudioUrl(songId, "stream"),
        resolvedSongId: songId,
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
