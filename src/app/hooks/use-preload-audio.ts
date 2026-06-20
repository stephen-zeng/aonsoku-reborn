import { useEffect, useMemo, useRef } from "react";
import { shouldUseNativePlaybackBackend } from "@/player/playback";
import {
  type AudioSourceDescriptor,
  audioSourceResolver,
  getAudioSourceUrl,
  revokeAudioSource,
} from "@/service/cache";
import {
  usePlayerCurrentList,
  usePlayerCurrentSongIndex,
  usePlayerLoop,
  usePlayerMediaType,
  usePlayerShuffle,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";

export function usePreloadAudio() {
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const preloadedSongIdRef = useRef<string | null>(null);
  const preloadSourceRef = useRef<AudioSourceDescriptor | null>(null);
  const { isSong } = usePlayerMediaType();
  const isShuffleActive = usePlayerShuffle();
  const loopState = usePlayerLoop();
  const currentList = usePlayerCurrentList();
  const currentSongIndex = usePlayerCurrentSongIndex();

  const nextSongId = useMemo(() => {
    if (!isSong) return null;
    if (isShuffleActive) return null;
    if (loopState === LoopState.One) return null;
    const nextIndex = currentSongIndex + 1;
    if (nextIndex < currentList.length) {
      return currentList[nextIndex].id;
    }
    if (loopState === LoopState.All && currentList.length > 0) {
      return currentList[0].id;
    }
    return null;
  }, [isSong, isShuffleActive, loopState, currentSongIndex, currentList]);

  useEffect(() => {
    if (!nextSongId || shouldUseNativePlaybackBackend()) {
      if (preloadRef.current) {
        preloadRef.current.removeAttribute("src");
        preloadRef.current.load();
        preloadRef.current = null;
        preloadedSongIdRef.current = null;
      }
      revokeAudioSource(preloadSourceRef.current);
      preloadSourceRef.current = null;
      return;
    }

    if (preloadedSongIdRef.current === nextSongId) return;

    revokeAudioSource(preloadSourceRef.current);
    preloadSourceRef.current = null;

    if (preloadRef.current) {
      preloadRef.current.removeAttribute("src");
      preloadRef.current.load();
    }

    if (!preloadRef.current) {
      preloadRef.current = new Audio();
      preloadRef.current.preload = "auto";
    }

    let cancelled = false;

    (async () => {
      const source = await audioSourceResolver.resolveSongSource(nextSongId);
      if (cancelled) {
        revokeAudioSource(source);
        return;
      }

      if (preloadRef.current) {
        preloadRef.current.src = getAudioSourceUrl(source);
      }
      preloadSourceRef.current = source;
      preloadedSongIdRef.current = nextSongId;
    })();

    return () => {
      cancelled = true;
    };
  }, [nextSongId]);

  useEffect(() => {
    return () => {
      if (preloadRef.current) {
        preloadRef.current.removeAttribute("src");
        preloadRef.current.load();
        preloadRef.current = null;
      }
      revokeAudioSource(preloadSourceRef.current);
      preloadSourceRef.current = null;
    };
  }, []);
}
