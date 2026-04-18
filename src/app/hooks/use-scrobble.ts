import { useEffect, useRef } from "react";
import { subsonic } from "@/service/subsonic";
import {
  useIsRemoteControlActive,
  usePlayerCurrentSong,
  usePlayerDuration,
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerProgress,
} from "@/store/player.store";

const SCROBBLE_THRESHOLD_PERCENT = 50;
const SCROBBLE_THRESHOLD_SECONDS = 60 * 4;

export function useScrobble() {
  const currentSong = usePlayerCurrentSong();
  const progress = usePlayerProgress();
  const currentDuration = usePlayerDuration();
  const isPlaying = usePlayerIsPlaying();
  const { isSong } = usePlayerMediaType();
  const isRemoteControlActive = useIsRemoteControlActive();

  const isScrobbleSentRef = useRef(false);
  const isNowPlayingSentRef = useRef(false);
  const progressTicks = useRef(0);
  const lastSongIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (currentSong?.id !== lastSongIdRef.current) {
      lastSongIdRef.current = currentSong?.id;
      isScrobbleSentRef.current = false;
      isNowPlayingSentRef.current = false;
      progressTicks.current = 0;
    }
  }, [currentSong?.id]);

  useEffect(() => {
    if (isRemoteControlActive || !isSong || !isPlaying) return;

    const progressPercentage =
      currentDuration > 0 ? (progress / currentDuration) * 100 : 0;

    if (progressPercentage === 0) {
      if (currentSong?.id && !isNowPlayingSentRef.current) {
        subsonic.scrobble.send(currentSong.id, false);
        isNowPlayingSentRef.current = true;
      }
    } else {
      progressTicks.current += 1;

      if (
        (progressTicks.current >= currentDuration / SCROBBLE_THRESHOLD_PERCENT ||
          progressTicks.current >= SCROBBLE_THRESHOLD_SECONDS) &&
        !isScrobbleSentRef.current &&
        currentSong?.id
      ) {
        subsonic.scrobble.send(currentSong.id);
        isScrobbleSentRef.current = true;
      }
    }
  }, [progress, currentDuration, isSong, isPlaying, currentSong?.id, isRemoteControlActive]);
}