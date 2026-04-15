import { RefObject, useCallback, useState } from "react";
import {
  useIsRemoteControlActive,
  usePlayerActions,
} from "@/store/player.store";
import { logger } from "@/utils/logger";

interface UseAudioSeekingOptions {
  audioRef: RefObject<HTMLAudioElement> | { current: HTMLAudioElement | null };
}

export function useAudioSeeking({ audioRef }: UseAudioSeekingOptions) {
  const { setProgress } = usePlayerActions();
  const isRemoteControlActive = useIsRemoteControlActive();
  const [localProgress, setLocalProgress] = useState(0);
  const [isLocalSeeking, setIsLocalSeeking] = useState(false);

  const updateAudioCurrentTime = useCallback(
    (value: number) => {
      if (isRemoteControlActive) return;
      const audio = audioRef.current;
      if (audio) {
        logger.info("Seeking to:", value);
        audio.currentTime = value;
      }
    },
    [audioRef, isRemoteControlActive],
  );

  const handleSeeking = useCallback((amount: number) => {
    setIsLocalSeeking(true);
    setLocalProgress(amount);
  }, []);

  const handleSeeked = useCallback(
    (amount: number) => {
      logger.info("Seek completed:", amount);
      setIsLocalSeeking(false);
      if (!isRemoteControlActive) {
        updateAudioCurrentTime(amount);
      }
      setProgress(amount);
      setLocalProgress(amount);
    },
    [isRemoteControlActive, setProgress, updateAudioCurrentTime],
  );

  const handleSeekedFallback = useCallback(() => {
    if (isLocalSeeking) {
      logger.info("Seek fallback triggered:", localProgress);
      setIsLocalSeeking(false);
      if (localProgress !== 0 || isLocalSeeking) {
        if (!isRemoteControlActive) {
          updateAudioCurrentTime(localProgress);
        }
        setProgress(localProgress);
      }
    }
  }, [
    isLocalSeeking,
    isRemoteControlActive,
    localProgress,
    setProgress,
    updateAudioCurrentTime,
  ]);

  return {
    localProgress,
    setLocalProgress,
    isLocalSeeking,
    setIsLocalSeeking,
    updateAudioCurrentTime,
    handleSeeking,
    handleSeeked,
    handleSeekedFallback,
  };
}
