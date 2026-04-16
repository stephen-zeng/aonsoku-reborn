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
import { calculateReplayGain, ReplayGainParams } from "@/utils/replayGain";
import { perceptualToGain } from "@/utils/volume";

type AudioPlayerProps = ComponentPropsWithoutRef<"audio"> & {
  audioRef: RefObject<HTMLAudioElement>;
  replayGain?: ReplayGainParams;
  onPlaybackError?: () => void;
  onReplayGainError?: () => void;
};

export function AudioPlayer({
  audioRef,
  replayGain,
  onPlaybackError,
  onReplayGainError,
  src,
  onLoadedMetadata,
  onTimeUpdate,
  onCanPlay,
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
    isSong &&
    replayGainEnabled &&
    !replayGainError &&
    !isRemoteControlActive;
  const shouldUseNativeAudio = !shouldUseWebAudioReplayGain;

  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryGenerationRef = useRef(0);
  const pendingResumePositionRef = useRef<number | null>(null);
  const resumeGuardActiveRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const effectPausingRef = useRef(false);
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

  useEffect(() => {
    if (src !== audioSrc) {
      logger.info("Audio source changed", {
        src,
        useNativeAudio: shouldUseNativeAudio,
        isRemoteControlActive,
      });
      cancelRetry();
      retryCountRef.current = 0;
      playPromiseRef.current = null;
      setAudioSrc(src || undefined);
    }
  }, [
    audioSrc,
    cancelRetry,
    isRemoteControlActive,
    shouldUseNativeAudio,
    src,
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
      if (retryCountRef.current >= MAX_RETRIES) {
        onPlaybackError?.();
        retryCountRef.current = 0;
        cancelRetry();
        return;
      }

      cancelRetry();

      const storeProgress = usePlayerStore.getState().playerProgress.progress;
      const resumePosition = Math.max(audio.currentTime, storeProgress);
      pendingResumePositionRef.current = resumePosition;
      resumeGuardActiveRef.current = true;
      logger.info("Retry will resume at position:", resumePosition);

      retryCountRef.current += 1;
      const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
      logger.info(
        `Retrying audio (attempt ${retryCountRef.current}) in ${delay}ms`,
      );

      const currentSrc = audio.src;
      const retryGeneration = retryGenerationRef.current;

      retryTimeoutRef.current = setTimeout(() => {
        const currentAudio = audioRef.current;
        const { isPlaying: shouldResume } = usePlayerStore.getState().playerState;

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
    [audioRef, cancelRetry, onPlaybackError, safePlay],
  );

  const handleSongError = useCallback(() => {
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

    if (
      audio.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED &&
      shouldUseWebAudioReplayGain
    ) {
      handleReplayGainSetupError();
    } else if (audio.error?.code !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      scheduleRetry(audio);
    }
  }, [
    audioRef,
    handleReplayGainSetupError,
    scheduleRetry,
    shouldUseWebAudioReplayGain,
  ]);

  const handleSongErrorRef = useRef(handleSongError);
  handleSongErrorRef.current = handleSongError;

  const handleRadioError = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    scheduleRetry(audio);
  }, [audioRef, scheduleRetry]);

  useEffect(() => {
    return () => {
      cancelRetry();
      retryCountRef.current = 0;
      playPromiseRef.current = null;
    };
  }, [cancelRetry]);

  useEffect(() => {
    if (!isPlaying) {
      cancelRetry();
    }
  }, [cancelRetry, isPlaying]);

  const handlePlaySuccess = useCallback(() => {
    retryCountRef.current = 0;
    clearRetryTimer();
    resumeGuardActiveRef.current = false;
  }, [clearRetryTimer]);

  const { setProgress: setStoreProgress } = usePlayerActions();

  // Effect: handle source changes (pause and reset state)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isSong) return;

    if (!audioSrc) {
      pauseAudio(audio);
    }
  }, [audioRef, audioSrc, isSong, pauseAudio]);

  // Effect: handle play/pause state changes
  useEffect(() => {
    async function handleSongPlayback() {
      const audio = audioRef.current;
      if (!audio || !isSong) return;

      if (!audioSrc) return;

      try {
        if (isPlaying) {
          if (shouldUseWebAudioReplayGain) {
            await resumeContext();
          }
          safePlay(audio, "Song");
        } else {
          pauseAudio(audio);
        }
      } catch (error) {
        logger.error("Audio playback failed", error);
        handleSongErrorRef.current();
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

  const handleError = useMemo(() => {
    if (isSong) return handleSongError;
    if (isRadio) return handleRadioError;

    return undefined;
  }, [handleRadioError, handleSongError, isRadio, isSong]);

  const applyPendingResume = useCallback(
    (audio: HTMLAudioElement) => {
      const resumePos = pendingResumePositionRef.current;
      if (resumePos === null) return;

      logger.info("Applying pending resume position:", resumePos);
      audio.currentTime = resumePos;
      setStoreProgress(Math.floor(resumePos));
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

    return "anonymous";
  }, [shouldUseWebAudioReplayGain]);

  return (
    <audio
      ref={audioRef}
      {...props}
      src={audioSrc}
      crossOrigin={crossOrigin}
      onError={handleError}
      onPlay={(e) => {
        handlePlaySuccess();
        props.onPlay?.(e);
      }}
      onPause={(e) => {
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
      onLoadedMetadata={handleLoadedMetadata}
      onDurationChange={(e) => props.onDurationChange?.(e)}
      onTimeUpdate={handleTimeUpdate}
      onCanPlay={handleCanPlay}
      playsInline
      preload="auto"
    />
  );
}
