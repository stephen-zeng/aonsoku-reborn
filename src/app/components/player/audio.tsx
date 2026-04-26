import {
  ComponentPropsWithoutRef,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAudioContext } from "@/app/hooks/use-audio-context";
import { getNetworkStatus } from "@/app/hooks/use-network-status";
import { useCacheStore } from "@/store/cache.store";
import {
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerVolume,
  useIsRemoteControlActive,
  useReplayGainActions,
  useReplayGainState,
  usePlayerActions,
  usePlayerStore,
} from "@/store/player.store";
import { logger } from "@/utils/logger";
import { manageMediaSession } from "@/utils/setMediaSession";
import { calculateReplayGain, ReplayGainParams } from "@/utils/replayGain";
import { perceptualToGain } from "@/utils/volume";

type AudioPlayerProps = ComponentPropsWithoutRef<"audio"> & {
  audioRef: RefObject<HTMLAudioElement>;
  replayGain?: ReplayGainParams;
  onPlaybackError?: () => void;
  onReplayGainError?: () => void;
  songId?: string;
};

export function AudioPlayer({
  audioRef,
  replayGain,
  onPlaybackError,
  onReplayGainError,
  src,
  songId,
  onLoadedMetadata,
  onTimeUpdate,
  onProgress,
  onCanPlay,
  onPlay,
  ...props
}: AudioPlayerProps) {
  const previousGainRef = useRef(1);
  const [audioSrc, setAudioSrc] = useState<string | undefined>(undefined);
  const { replayGainEnabled, replayGainError } = useReplayGainState();
  const { isSong, isRadio } = usePlayerMediaType();
  const { setReplayGainEnabled, setReplayGainError } = useReplayGainActions();
  const { volume } = usePlayerVolume();
  const isPlaying = usePlayerIsPlaying();
  const isRemoteControlActive = useIsRemoteControlActive();

  const shouldUseWebAudioReplayGain =
    isSong && replayGainEnabled && !replayGainError && !isRemoteControlActive;
  const shouldUseNativeAudio = !shouldUseWebAudioReplayGain;

  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryGenerationRef = useRef(0);
  const pendingResumePositionRef = useRef<number | null>(null);
  const resumeGuardActiveRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const effectPausingRef = useRef(false);
  const srcChangingRef = useRef(false);
  const loadedSongIdRef = useRef<string | undefined>(undefined);
  const rangeFallbackRef = useRef(false);
  const MAX_RETRIES = 5;

  const clearRetryTimer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const cancelRetry = useCallback(() => {
    clearRetryTimer();
    retryGenerationRef.current += 1;
    pendingResumePositionRef.current = null;
    resumeGuardActiveRef.current = false;
  }, [clearRetryTimer]);

  const { setProgress: setStoreProgress } = usePlayerActions();

  useEffect(() => {
    if (src !== audioSrc) {
      logger.info("Audio source changed", {
        src,
        useNativeAudio: shouldUseNativeAudio,
        isRemoteControlActive: isRemoteControlActive,
      });
      cancelRetry();
      retryCountRef.current = 0;
      rangeFallbackRef.current = false;
      playPromiseRef.current = null;
      srcChangingRef.current = true;
      loadedSongIdRef.current = songId;

      const state = usePlayerStore.getState();
      if (state.playerState.isPlaying && !state.remoteControl.active) {
        manageMediaSession.ensurePlaybackStatePlaying();
      }

      setAudioSrc(src || undefined);
    }
  }, [
    audioSrc,
    cancelRetry,
    isRemoteControlActive,
    shouldUseNativeAudio,
    src,
    songId,
  ]);

  const audioVolume = useMemo(() => perceptualToGain(volume), [volume]);

  const gainValue = useMemo(() => {
    if (!shouldUseWebAudioReplayGain || !replayGain) {
      return audioVolume;
    }

    const gain = calculateReplayGain(replayGain);

    return audioVolume * gain;
  }, [audioVolume, replayGain, shouldUseWebAudioReplayGain]);

  const handleReplayGainSetupError = useCallback(() => {
    onReplayGainError?.();
    setReplayGainEnabled(false);
    setReplayGainError(true);
  }, [onReplayGainError, setReplayGainEnabled, setReplayGainError]);

  const { resumeContext, setupGain } = useAudioContext(audioRef.current, {
    enabled: shouldUseWebAudioReplayGain,
    onSetupError: handleReplayGainSetupError,
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (shouldUseNativeAudio) {
      audio.volume = audioVolume;
      previousGainRef.current = Number.NaN;
      logger.info("Native audio volume set:", audioVolume);
      return;
    }

    audio.volume = 1;
    if (gainValue === previousGainRef.current) return;

    setupGain(gainValue, replayGain);
    previousGainRef.current = gainValue;
  }, [
    audioRef,
    audioVolume,
    gainValue,
    replayGain,
    setupGain,
    shouldUseNativeAudio,
  ]);

  const safePlay = useCallback(
    (audio: HTMLAudioElement, contextLabel: string) => {
      const state = usePlayerStore.getState();
      if (state.playerState.isPlaying && !state.remoteControl.active) {
        manageMediaSession.ensurePlaybackStatePlaying();
      }
      const playPromise = audio.play();
      const promise = playPromise ?? undefined;
      playPromiseRef.current = promise ?? null;
      if (promise !== undefined) {
        promise
          .then(() => {
            if (playPromiseRef.current === promise) {
              playPromiseRef.current = null;
            }
          })
          .catch((error) => {
            if (playPromiseRef.current === promise) {
              playPromiseRef.current = null;
            }
            if (error.name === "AbortError") {
              logger.debug(`${contextLabel} play was aborted by pause`, error);
            } else {
              logger.error(`${contextLabel} play was prevented:`, error);
            }
          });
      }
    },
    [],
  );

  const pauseAudio = useCallback((audio: HTMLAudioElement) => {
    const pending = playPromiseRef.current;
    if (pending) {
      pending.catch(() => {});
      playPromiseRef.current = null;
    }
    effectPausingRef.current = true;
    audio.pause();
    if (audio.paused) {
      effectPausingRef.current = false;
    }
  }, []);

  const scheduleRetry = useCallback(
    (audio: HTMLAudioElement) => {
      if (!getNetworkStatus().isOnline) {
        logger.info("Offline, skipping audio retry");
        cancelRetry();
        return;
      }

      if (retryCountRef.current >= MAX_RETRIES) {
        if (!rangeFallbackRef.current) {
          rangeFallbackRef.current = true;
          retryCountRef.current = 0;
          const storeProgress =
            usePlayerStore.getState().playerProgress.progress;
          const fallbackPosition = Math.max(audio.currentTime, storeProgress);
          pendingResumePositionRef.current = fallbackPosition;
          resumeGuardActiveRef.current = true;
          logger.info(
            "All retries failed — retrying from position 0 with resume guard (possible 416 Range Not Satisfiable)",
          );
          audio.currentTime = 0;
          setStoreProgress(0);
          audio.load();
          safePlay(audio, "RangeFallback");
          return;
        }
        onPlaybackError?.();
        retryCountRef.current = 0;
        cancelRetry();
        return;
      }

      cancelRetry();

      const storeProgress = usePlayerStore.getState().playerProgress.progress;
      const resumePosition = rangeFallbackRef.current
        ? 0
        : Math.max(audio.currentTime, storeProgress);
      pendingResumePositionRef.current = resumePosition;
      resumeGuardActiveRef.current = true;
      logger.info("Retry will resume at position:", resumePosition);

      retryCountRef.current += 1;
      const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
      logger.info(
        `Retrying audio (attempt ${retryCountRef.current}) in ${delay}ms, saved progress: ${resumePosition}`,
      );

      const currentSrc = audio.src;
      const retryGeneration = retryGenerationRef.current;

      retryTimeoutRef.current = setTimeout(() => {
        if (!getNetworkStatus().isOnline) {
          cancelRetry();
          return;
        }

        const currentAudio = audioRef.current;
        const { isPlaying: shouldResume } =
          usePlayerStore.getState().playerState;

        if (
          retryGenerationRef.current !== retryGeneration ||
          !currentAudio ||
          currentAudio.src !== currentSrc ||
          !shouldResume
        ) {
          logger.info("Retry skipped: source changed or playback stopped");
          if (retryGenerationRef.current === retryGeneration) {
            pendingResumePositionRef.current = null;
            resumeGuardActiveRef.current = false;
          }
          return;
        }

        currentAudio.load();
        safePlay(currentAudio, "Retry");
      }, delay);
    },
    [audioRef, cancelRetry, onPlaybackError, safePlay, setStoreProgress],
  );

  const handleAudioError = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const errorDetails = {
      src: audio.src,
      networkState: audio.networkState,
      readyState: audio.readyState,
      error: audio.error
        ? {
            code: audio.error.code,
            message: audio.error.message,
          }
        : null,
    };

    logger.error("Audio load error", errorDetails);

    const errorCode = audio.error?.code;

    switch (errorCode) {
      case MediaError.MEDIA_ERR_ABORTED:
        logger.info("Audio aborted, skipping retry");
        return;

      case MediaError.MEDIA_ERR_NETWORK:
        scheduleRetry(audio);
        return;

      case MediaError.MEDIA_ERR_DECODE:
        if (isRadio) {
          scheduleRetry(audio);
        } else {
          logger.error("Decode error, skipping to next song");
          onPlaybackError?.();
          cancelRetry();
        }
        return;

      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        if (shouldUseWebAudioReplayGain) {
          handleReplayGainSetupError();
        }
        return;

      default:
        scheduleRetry(audio);
    }
  }, [
    audioRef,
    cancelRetry,
    handleReplayGainSetupError,
    isRadio,
    onPlaybackError,
    scheduleRetry,
    shouldUseWebAudioReplayGain,
  ]);

  const handleRadioError = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    scheduleRetry(audio);
  }, [audioRef, scheduleRetry]);

  const handleError = useMemo(() => {
    if (isSong) return handleAudioError;
    if (isRadio) return handleRadioError;

    return undefined;
  }, [handleAudioError, handleRadioError, isRadio, isSong]);

  const handleAudioErrorRef = useRef(handleAudioError);
  handleAudioErrorRef.current = handleAudioError;

  useEffect(() => {
    return () => {
      cancelRetry();
      retryCountRef.current = 0;
      rangeFallbackRef.current = false;
      playPromiseRef.current = null;
    };
  }, [cancelRetry]);

  useEffect(() => {
    if (!isPlaying) {
      cancelRetry();
    }
  }, [cancelRetry, isPlaying]);

  useEffect(() => {
    const unsubscribe = useCacheStore.subscribe(
      (s) => s.status.isOnline,
      (isOnline, prevIsOnline) => {
        if (!prevIsOnline && isOnline) {
          const audio = audioRef.current;
          if (!audio || retryCountRef.current === 0) return;

          logger.info("Server reachable again, retrying audio playback");
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
          }
          retryCountRef.current = 0;
          rangeFallbackRef.current = false;
          audio.load();
          safePlay(audio, "Reconnect");
        }
      },
    );
    return unsubscribe;
  }, [audioRef, safePlay]);

  const handlePlaySuccess = useCallback(() => {
    retryCountRef.current = 0;
    rangeFallbackRef.current = false;
    clearRetryTimer();
    resumeGuardActiveRef.current = false;
  }, [clearRetryTimer]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isSong) return;

    if (!audioSrc) {
      pauseAudio(audio);
    }
  }, [audioRef, audioSrc, isSong, pauseAudio]);

  useEffect(() => {
    async function handleSongPlayback() {
      const audio = audioRef.current;
      if (!audio || !isSong) return;

      if (!audioSrc) return;

      try {
        if (isPlaying) {
          if (songId !== loadedSongIdRef.current) {
            return;
          }
          if (shouldUseWebAudioReplayGain) {
            await resumeContext();
          }
          safePlay(audio, "Song");
        } else {
          pauseAudio(audio);
        }
      } catch (error) {
        logger.error("Audio playback failed", error);
        handleAudioErrorRef.current();
      }
    }
    handleSongPlayback();
  }, [
    audioRef,
    audioSrc,
    isPlaying,
    isSong,
    pauseAudio,
    resumeContext,
    safePlay,
    shouldUseWebAudioReplayGain,
    songId,
  ]);

  useEffect(() => {
    async function handleRadio() {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.load();
        safePlay(audio, "Radio");
      } else {
        pauseAudio(audio);
      }
    }
    if (isRadio) handleRadio();
  }, [audioRef, isPlaying, isRadio, pauseAudio, safePlay]);

  const applyPendingResume = useCallback(
    (audio: HTMLAudioElement) => {
      const resumePos = pendingResumePositionRef.current;
      if (resumePos === null) return;

      const duration = audio.duration;
      const clampedPos =
        Number.isFinite(duration) && duration > 0
          ? Math.min(resumePos, duration - 0.1)
          : resumePos;

      logger.info("Applying pending resume position:", clampedPos);
      audio.currentTime = clampedPos;
      setStoreProgress(Math.floor(clampedPos));
    },
    [setStoreProgress],
  );

  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      onLoadedMetadata?.(e);
    },
    [onLoadedMetadata],
  );

  const handleCanPlay = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const audio = e.currentTarget;
      if (
        resumeGuardActiveRef.current &&
        pendingResumePositionRef.current !== null
      ) {
        applyPendingResume(audio);
        pendingResumePositionRef.current = null;
      }
      resumeGuardActiveRef.current = false;
      onCanPlay?.(e);
    },
    [applyPendingResume, onCanPlay],
  );

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      if (resumeGuardActiveRef.current) {
        return;
      }
      onTimeUpdate?.(e);
    },
    [onTimeUpdate],
  );

  const crossOrigin = useMemo(() => {
    if (!shouldUseWebAudioReplayGain) return undefined;
    if (audioSrc?.startsWith("blob:")) return undefined;

    return "anonymous";
  }, [shouldUseWebAudioReplayGain, audioSrc]);

  return (
    <audio
      ref={audioRef}
      {...props}
      src={audioSrc}
      crossOrigin={crossOrigin}
      onError={handleError}
      onTimeUpdate={handleTimeUpdate}
      onProgress={onProgress}
      onLoadedMetadata={handleLoadedMetadata}
      onDurationChange={(e) => props.onDurationChange?.(e)}
      onCanPlay={handleCanPlay}
      onPlay={(e) => {
        handlePlaySuccess();
        onPlay?.(e);
      }}
      onPause={(e) => {
        if (srcChangingRef.current) {
          srcChangingRef.current = false;
          const state = usePlayerStore.getState();
          if (state.playerState.isPlaying && !state.remoteControl.active) {
            manageMediaSession.ensurePlaybackStatePlaying();
          }
          return;
        }
        if (effectPausingRef.current) {
          effectPausingRef.current = false;
          return;
        }
        if (
          usePlayerStore.getState().playerState.isPlaying &&
          e.currentTarget.error
        ) {
          logger.info("Ignoring pause event triggered by playback error");
          return;
        }
        props.onPause?.(e);
      }}
      playsInline
      preload="auto"
    />
  );
}
