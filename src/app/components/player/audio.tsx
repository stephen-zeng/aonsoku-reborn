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
import { useIsOffline } from "@/store/offline.store";
import {
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerVolume,
  useRemoteControlState,
  useReplayGainActions,
  useReplayGainState,
} from "@/store/player.store";
import { logger } from "@/utils/logger";
import { calculateReplayGain, ReplayGainParams } from "@/utils/replayGain";

type AudioPlayerProps = ComponentPropsWithoutRef<"audio"> & {
  audioRef: RefObject<HTMLAudioElement>;
  replayGain?: ReplayGainParams;
};

export function AudioPlayer({
  audioRef,
  replayGain,
  src,
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
  const isOfflineMode = useIsOffline();
  const offlineToastShownRef = useRef(false);

  // Use native audio by default, only use AudioContext when acting as a remote controller
  const shouldUseNativeAudio = !isRemoteControlActive;

  // Update audio source only when it actually changes and is valid
  useEffect(() => {
    if (src !== audioSrc) {
      logger.info("Audio source changed", {
        src,
        useNativeAudio: shouldUseNativeAudio,
        isRemoteControlActive,
      });
      // Clear any pending retry when the source changes
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      retryCountRef.current = 0;
      offlineToastShownRef.current = false;
      setAudioSrc(src || undefined);
    }
  }, [src, audioSrc, shouldUseNativeAudio, isRemoteControlActive]);

  const gainValue = useMemo(() => {
    const audioVolume = volume / 100;

    // In native audio mode, don't use replay gain - just use volume
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

  // Ignore AudioContext gain in native mode, when not a song, or when there's a replay gain error
  const ignoreGain = shouldUseNativeAudio || !isSong || replayGainError;

  // In native mode, set audio volume directly instead of using gain node
  useEffect(() => {
    if (!audioRef.current) return;

    if (shouldUseNativeAudio) {
      // Use native volume control
      audioRef.current.volume = volume / 100;
      logger.info("Native audio volume set:", volume / 100);
      return;
    }

    // Use AudioContext gain when in remote control mode
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

  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RETRIES = 5;

  const scheduleRetry = useCallback(
    (audio: HTMLAudioElement) => {
      if (isOfflineMode) {
        if (!offlineToastShownRef.current) {
          offlineToastShownRef.current = true;
          toast.warning(t("offline.songUnavailable"));
        }
        return;
      }

      if (retryCountRef.current >= MAX_RETRIES) {
        toast.error(t("warnings.songError"));
        retryCountRef.current = 0;
        return;
      }

      retryCountRef.current += 1;
      const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
      logger.info(
        `Retrying audio (attempt ${retryCountRef.current}) in ${delay}ms`,
      );

      retryTimeoutRef.current = setTimeout(() => {
        audio.load();
        audio.play().catch((err) => {
          logger.error("Retry play failed:", err);
        });
      }, delay);
    },
    [isOfflineMode, t],
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

  const handleRadioError = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    scheduleRetry(audio);
  }, [audioRef, scheduleRetry]);

  // Reset retry count on successful play and clear pending retries on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const handlePlaySuccess = useCallback(() => {
    retryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!audioSrc && isOfflineMode && isSong && isPlaying) {
      if (!offlineToastShownRef.current) {
        offlineToastShownRef.current = true;
        toast.warning(t("offline.songUnavailable"));
      }
    }
  }, [audioSrc, isOfflineMode, isPlaying, isSong, t]);

  useEffect(() => {
    async function handleSong() {
      const audio = audioRef.current;
      if (!audio) return;

      try {
        if (!audioSrc) {
          audio.pause();
          return;
        }

        if (isPlaying) {
          // Only resume AudioContext if in remote control mode (not using native audio)
          if (isSong && !shouldUseNativeAudio) {
            await resumeContext();
          }
          // Try to play, and if it fails due to autoplay policy, log it
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              logger.error("Play was prevented:", error);
              // If play was prevented, try to resume on next user interaction
            });
          }
        } else {
          audio.pause();
          // Ensure audio is fully stopped and won't continue playing
          // This is especially important on mobile devices
          if (audio.currentTime > 0) {
            // Force stop by setting currentTime to itself
            // This clears the audio buffer on some browsers
            const currentTime = audio.currentTime;
            audio.currentTime = currentTime;
          }
        }
      } catch (error) {
        logger.error("Audio playback failed", error);
        handleSongError();
      }
    }
    if (isSong) handleSong();
  }, [
    audioRef,
    audioSrc,
    handleSongError,
    isPlaying,
    isSong,
    resumeContext,
    shouldUseNativeAudio,
  ]);

  useEffect(() => {
    async function handleRadio() {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.load();
        await audio.play();
      } else {
        audio.pause();
      }
    }
    if (isRadio) handleRadio();
  }, [audioRef, isPlaying, isRadio]);

  const handleError = useMemo(() => {
    if (isSong) return handleSongError;
    if (isRadio) return handleRadioError;

    return undefined;
  }, [handleRadioError, handleSongError, isRadio, isSong]);

  const crossOrigin = useMemo(() => {
    // In native audio mode, don't use crossOrigin as we're not using AudioContext
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
      playsInline
      preload="auto"
    />
  );
}
