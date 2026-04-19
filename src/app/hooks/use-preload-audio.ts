import { useEffect, useMemo, useRef } from "react";
import { getSongStreamUrl } from "@/api/httpClient";
import {
  usePlayerCurrentList,
  usePlayerCurrentSongIndex,
  usePlayerMediaType,
  usePlayerLoop,
  usePlayerShuffle,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";

export function usePreloadAudio() {
  const preloadRef = useRef<HTMLAudioElement | null>(null);
  const preloadedSongIdRef = useRef<string | null>(null);
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
    if (!nextSongId) {
      if (preloadRef.current) {
        preloadRef.current.removeAttribute("src");
        preloadRef.current.load();
        preloadRef.current = null;
        preloadedSongIdRef.current = null;
      }
      return;
    }

    if (preloadedSongIdRef.current === nextSongId) return;

    if (preloadRef.current) {
      preloadRef.current.removeAttribute("src");
      preloadRef.current.load();
    }

    if (!preloadRef.current) {
      preloadRef.current = new Audio();
      preloadRef.current.preload = "auto";
    }

    preloadRef.current.src = getSongStreamUrl(nextSongId);
    preloadedSongIdRef.current = nextSongId;
  }, [nextSongId]);

  useEffect(() => {
    return () => {
      if (preloadRef.current) {
        preloadRef.current.removeAttribute("src");
        preloadRef.current.load();
        preloadRef.current = null;
      }
    };
  }, []);
}
