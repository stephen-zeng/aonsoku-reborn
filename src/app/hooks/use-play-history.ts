import { useEffect, useRef } from "react";
import {
  useIsRemoteControlActive,
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerStore,
} from "@/store/player.store";
import { usePlayHistoryStore } from "@/store/playHistory.store";
import type { ISong } from "@/types/responses/song";

const MIN_PLAY_MS = 10_000;

interface TrackedSong {
  song: ISong;
  playStartMark: number;
  accumulatedPlayMs: number;
}

function computePlayedMs(
  tracked: TrackedSong,
  now: number,
  pauseStart: number | null,
) {
  let totalPlayMs = tracked.accumulatedPlayMs;
  if (pauseStart === null) {
    totalPlayMs += now - tracked.playStartMark;
  } else {
    totalPlayMs += pauseStart - tracked.playStartMark;
  }
  return totalPlayMs;
}

function tryAddToHistory(tracked: TrackedSong, pauseStart: number | null) {
  const totalPlayMs = computePlayedMs(tracked, performance.now(), pauseStart);
  if (totalPlayMs >= MIN_PLAY_MS) {
    usePlayHistoryStore.getState().actions.addToHistory(tracked.song);
  }
}

function useCurrentSongId() {
  return usePlayerStore((state) => state.songlist.currentSong?.id);
}

export function usePlayHistory() {
  const trackedRef = useRef<TrackedSong | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const prevSongIdRef = useRef<string | undefined>(undefined);

  const songId = useCurrentSongId();
  const { isSong } = usePlayerMediaType();
  const isPlaying = usePlayerIsPlaying();
  const isRemoteControlActive = useIsRemoteControlActive();

  useEffect(() => {
    const prevSongId = prevSongIdRef.current;
    prevSongIdRef.current = songId;

    if (prevSongId !== undefined && prevSongId !== songId) {
      const tracked = trackedRef.current;
      if (tracked && tracked.song.id === prevSongId) {
        tryAddToHistory(tracked, pauseStartRef.current);
      }
      trackedRef.current = null;
      pauseStartRef.current = null;
    }

    if (!isSong || !songId || !isPlaying || isRemoteControlActive) {
      if (pauseStartRef.current === null && trackedRef.current) {
        pauseStartRef.current = performance.now();
      }
      return;
    }

    if (trackedRef.current) return;

    const currentSongObj = usePlayerStore.getState().songlist.currentSong;
    if (!currentSongObj || currentSongObj.id !== songId) return;

    trackedRef.current = {
      song: { ...currentSongObj },
      playStartMark: performance.now(),
      accumulatedPlayMs: 0,
    };
    pauseStartRef.current = null;
  }, [isSong, songId, isPlaying, isRemoteControlActive]);

  useEffect(() => {
    const tracked = trackedRef.current;
    if (!tracked) return;

    if (isPlaying) {
      if (pauseStartRef.current !== null) {
        const playedBeforePause = pauseStartRef.current - tracked.playStartMark;
        tracked.accumulatedPlayMs += playedBeforePause;
        tracked.playStartMark = performance.now();
        pauseStartRef.current = null;
      }
    } else {
      if (pauseStartRef.current === null) {
        pauseStartRef.current = performance.now();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      const tracked = trackedRef.current;
      if (tracked) {
        tryAddToHistory(tracked, pauseStartRef.current);
      }
    };
  }, []);
}
