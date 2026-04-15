import {
  ComponentPropsWithoutRef,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useAudioContext } from "@/app/hooks/use-audio-context";
import {
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerVolume,
  useRemoteControlState,
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
};

export function AudioPlayer({
  audioRef,
  replayGain,
  src,
  onLoadedMetadata,
  onTimeUpdate,
  onCanPlay,
  ...props
}: AudioPlayerProps) {
  const { t } = useTranslation();
  const [previousGain, setPreviousGain] = useState(1);
  const [audioSrc, setAudioSrc] = useState<string | undefined>(undefined);
  const { replayGainEnabled, replayGainError } = useReplayGainState();
  const { isSong, isRadio } = usePlayerMediaType();
  const { setReplayGainEnabled, setReplayGainError } = useReplayGainActions();
  const { volume } = usePlayerVolume();
  const isPlaying = usePlayerIsPlaying();
  const { active: isRemoteControlActive } = useRemoteControlState();

  const shouldUseNativeAudio = !isRemoteControlActive;

  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingResumePositionRef = useRef<number | null>(null);
  const resumeGuardActiveRef = useRef(false);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const effectPausingRef = useRef(false);
  const MAX_RETRIES = 5;

  useEffect(() => {
    if (src !== audioSrc) {
      logger.info("Audio source changed", {
        src,
        useNativeAudio: shouldUseNativeAudio,
        isRemoteControlActive,
      });
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryCountRef.current = 0;
      pendingResumePositionRef.current = null;
      resumeGuardActiveRef.current = false;
      playPromiseRef.current = null;
      setAudioSrc(src || undefined);
    }
  }, [src, audioSrc, shouldUseNativeAudio, isRemoteControlActive]);

  const gainValue = useMemo(() => {
    const audioVolume = perceptualToGain(volume);

    if (shouldUseNativeAudio) {
      return audioVolume * 1;
    }

    if (!replayGain || !replayGainEnabled) {
      return audioVolume * 1;
    }
    const gain = calculateReplayGain(replayGain);

    return audioVolume * gain;
  }, [replayGain, replayGainEnabled, volume, shouldUseNativeAudio]);

  const { resumeContext, setupGain } = useAudioContext(audioRef.current);

  const ignoreGain = shouldUseNativeAudio || !isSong || replayGainError;

  useEffect(() => {
    if (!audioRef.current) return;

    if (shouldUseNativeAudio) {
      audioRef.current.volume = perceptualToGain(volume);
      logger.info("Native audio volume set:", perceptualToGain(volume));
      return;
    }

    if (ignoreGain) return;
    if (gainValue === previousGain) return;

    setupGain(gainValue, replayGain);
    setPreviousGain(gainValue);
  }, [
    audioRef,
    ignoreGain,
    gainValue,
    previousGain,
    replayGain,
    setupGain,
    shouldUseNativeAudio,
    volume,
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
        toast.error(t("warnings.songError"));
        retryCountRef.current = 0;
        pendingResumePositionRef.current = null;
        resumeGuardActiveRef.current = false;
        return;
      }

      const storeProgress = usePlayerStore.getState().playerProgress.progress;
      const resumePosition = Math.max(audio.currentTime, storeProgress);
      pendingResumePositionRef.current = resumePosition;
      resumeGuardActiveRef.current = true;
      logger.info("Retry will resume at position:", resumePosition);

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      retryCountRef.current += 1;
      const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
      logger.info(
        `Retrying audio (attempt ${retryCountRef.current}) in ${delay}ms`,
      );

      const currentSrc = audio.src;

      retryTimeoutRef.current = setTimeout(() => {
        const currentAudio = audioRef.current;
        if (
          !currentAudio ||
          currentAudio.src !== currentSrc ||
          currentAudio.paused
        ) {
          logger.info("Retry skipped: source changed or audio paused");
          pendingResumePositionRef.current = null;
          resumeGuardActiveRef.current = false;
          return;
        }

        currentAudio.load();
        safePlay(currentAudio, "Retry");
      }, delay);
    },
    [t, audioRef, safePlay],
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
      replayGainEnabled
    ) {
      toast.error(t("warnings.songError"));
      setReplayGainEnabled(false);
      setReplayGainError(true);
      window.location.reload();
    } else if (audio.error?.code !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      scheduleRetry(audio);
    }
  }, [
    audioRef,
    replayGainEnabled,
    scheduleRetry,
    setReplayGainEnabled,
    setReplayGainError,
    t,
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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      retryCountRef.current = 0;
      pendingResumePositionRef.current = null;
      resumeGuardActiveRef.current = false;
    };
  }, []);

  const handlePlaySuccess = useCallback(() => {
    retryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    resumeGuardActiveRef.current = false;
  }, []);

  const { setProgress: setStoreProgress } = usePlayerActions();

  useEffect(() => {
    async function handleSong() {
      const audio = audioRef.current;
      if (!audio) return;

      try {
        if (!audioSrc) {
          pauseAudio(audio);
          return;
        }

        if (isPlaying) {
          if (isSong && !shouldUseNativeAudio) {
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
    if (isSong) handleSong();
  }, [
    audioRef,
    audioSrc,
    isPlaying,
    isSong,
    pauseAudio,
    resumeContext,
    safePlay,
    shouldUseNativeAudio,
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
    if (shouldUseNativeAudio) return undefined;

    if (!isSong || replayGainError) return undefined;

    return "anonymous";
  }, [isSong, replayGainError, shouldUseNativeAudio]);

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
