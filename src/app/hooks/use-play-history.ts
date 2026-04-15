import { useEffect, useRef } from "react";
import { usePlayHistoryStore } from "@/store/playHistory.store";
import {
  useIsRemoteControlActive,
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerSonglist,
  usePlayerStore,
} from "@/store/player.store";

export function usePlayHistory() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedSongIdRef = useRef<string | null>(null);
  const { currentSongIndex, currentList } = usePlayerSonglist();
  const { isSong } = usePlayerMediaType();
  const isPlaying = usePlayerIsPlaying();
  const isRemoteControlActive = useIsRemoteControlActive();
  const songId = currentList[currentSongIndex]?.id;

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isSong || !songId || !isPlaying || isRemoteControlActive) {
      playedSongIdRef.current = null;
      return;
    }

    const currentSong = usePlayerStore.getState().songlist.currentSong;
    if (!currentSong) return;

    playedSongIdRef.current = songId;
    const songToRecord = { ...currentSong };

    timerRef.current = setTimeout(() => {
      if (playedSongIdRef.current === songId) {
        usePlayHistoryStore.getState().actions.addToHistory(songToRecord);
      }
    }, 10_000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      playedSongIdRef.current = null;
    };
  }, [isSong, songId, isPlaying, isRemoteControlActive]);
}
