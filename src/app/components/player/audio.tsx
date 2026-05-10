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
import { isIOS } from "@/utils/platform";
import { LoopState } from "@/types/playerContext";

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
  onPause,
  onEnded,
  ...props
}: AudioPlayerProps) {
  const previousGainRef = useRef(1);
  const [audioSrc, setAudioSrc] = useState<string | undefined>(undefined);
  const { replayGainEnabled, replayGainError } = useReplayGainState();
  const { isSong, isRadio } = usePlayerMediaType();
  const { setReplayGainEnabled, setReplayGainError } = useReplayGainActions();
  const { volume } = usePlayerVolume();
  const isPlaying = usePlayerIsPlaying();
  const seekToStart = usePlayerStore((s) => s.playerState.seekToStart);
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
  const loopRestartingRef = useRef(false);
  const syncPlayHandledRef = useRef(false);
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
      logger.info(`[AudioSrcChange] newSrc=${src?.slice(-60)} | oldSrc=${audioSrc?.slice(-60)} | cancelledRetry=${!!retryTimeoutRef.current} | retryCount=${retryCountRef.current} | srcChangingRef=true`);
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
    src,
    songId,
  ]);

  const audioVolume = useMemo(
    () => (isIOS() ? 1 : perceptualToGain(volume)),
    [volume],
  );

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
      logger.info(`[safePlay] source=${contextLabel} | readyState=${audio.readyState} | currentTime=${audio.currentTime.toFixed(2)} | paused=${audio.paused} | ended=${audio.ended} | src=${audio.src?.slice(-60)}`);
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
            logger.info(`[safePlay:OK] source=${contextLabel} | currentTime=${audio.currentTime.toFixed(2)}`);
          })
          .catch((error) => {
            if (playPromiseRef.current === promise) {
              playPromiseRef.current = null;
            }
            if (error.name === "AbortError") {
              logger.info(`[safePlay:ABORTED] source=${contextLabel} | expected=${contextLabel === "LoopRestartSync" || contextLabel === "Song" ? "check" : "unknown"}`);
            } else {
              logger.error(`[safePlay:ERROR] source=${contextLabel} | error=${error.name} ${error.message}`);
            }
          });
      }
    },
    [],
  );

  const pauseAudio = useCallback((audio: HTMLAudioElement) => {
    logger.info(`[pauseAudio] currentTime=${audio.currentTime.toFixed(2)} | duration=${audio.duration?.toFixed(2)} | src=${audio.src?.slice(-60)}`);
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
        logger.info("[scheduleRetry] Offline, skipping retry");
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
          logger.info("[scheduleRetry] All retries failed — retrying from position 0", { fallbackPosition, generation: retryGenerationRef.current });
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

      retryCountRef.current += 1;
      const delay = Math.pow(2, retryCountRef.current - 1) * 1000;
      logger.info(`[scheduleRetry] attempt=${retryCountRef.current}/${MAX_RETRIES} | delay=${delay}ms | fromPosition=${resumePosition.toFixed(2)} | generation=${retryGenerationRef.current}`);

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

    const errorCode = audio.error?.code;
    logger.info(`[onError] code=${errorCode} | message=${audio.error?.message} | mediaType=${isSong ? "song" : isRadio ? "radio" : "unknown"} | retryAttempt=${retryCountRef.current + 1}/5 | src=${audio.src?.slice(-60)}`);

    switch (errorCode) {
      case MediaError.MEDIA_ERR_ABORTED:
        logger.info("[onError:ABORTED] Skipping retry");
        return;

      case MediaError.MEDIA_ERR_NETWORK:
        scheduleRetry(audio);
        return;

      case MediaError.MEDIA_ERR_DECODE:
        if (isRadio) {
          scheduleRetry(audio);
        } else {
          logger.info("[onError:DECODE] Skipping to next song");
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
    isSong,
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

      logger.info(`[PlayEffect] isPlaying=${isPlaying} | seekToStart=${seekToStart} | audio.paused=${audio.paused} | audio.ended=${audio.ended} | audio.currentTime=${audio.currentTime.toFixed(2)} | audio.readyState=${audio.readyState} | syncPlayHandled=${syncPlayHandledRef.current} | srcChanging=${srcChangingRef.current} | src=${audio.src?.slice(-60)}`);

      try {
        if (isPlaying) {
          if (songId !== loadedSongIdRef.current) {
            logger.info(`[PlayEffect:SKIP] reason=songIdMismatch | songId=${songId} | loadedSongId=${loadedSongIdRef.current}`);
            return;
          }
          if (seekToStart) {
            logger.info(`[PlayEffect:seekToStart] songId=${songId} | setting currentTime=0`);
            loopRestartingRef.current = true;
            audio.currentTime = 0;
            usePlayerStore.setState((state) => {
              state.playerState.seekToStart = false;
            });
          } else if (audio.ended && songId === loadedSongIdRef.current) {
            logger.info(`[PlayEffect:endedRestart] songId=${songId} | setting currentTime=0`);
            loopRestartingRef.current = true;
            audio.currentTime = 0;
          }
          if (shouldUseWebAudioReplayGain) {
            await resumeContext();
          }

          if (syncPlayHandledRef.current) {
            logger.info("[PlayEffect:SKIP] reason=syncPlayHandledAlready | clearing flag");
            syncPlayHandledRef.current = false;
            return;
          }

          logger.info("[PlayEffect:play] → calling safePlay(\"Song\")");
          safePlay(audio, "Song");
        } else {
          syncPlayHandledRef.current = false;
          logger.info("[PlayEffect:pause] → calling pauseAudio");
          pauseAudio(audio);
        }
      } catch (error) {
        logger.error("[PlayEffect:ERROR]", error);
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
    seekToStart,
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
        logger.info(`[onPlay] currentTime=${e.currentTarget.currentTime.toFixed(2)} | duration=${e.currentTarget.duration?.toFixed(2)} | loopRestarting=${loopRestartingRef.current} | syncPlayHandled=${syncPlayHandledRef.current}`);
        loopRestartingRef.current = false;
        handlePlaySuccess();
        onPlay?.(e);
      }}
      onPause={(e) => {
        const audio = e.currentTarget;
        const storeState = usePlayerStore.getState();
        logger.info(`[onPause] currentTime=${audio.currentTime.toFixed(2)} | duration=${audio.duration?.toFixed(2)} | paused=${audio.paused} | ended=${audio.ended} | loopRestarting=${loopRestartingRef.current} | srcChanging=${srcChangingRef.current} | effectPausing=${effectPausingRef.current} | isPlaying_store=${storeState.playerState.isPlaying} | audioError=${!!audio.error} | error=${audio.error?.code}`);

        if (loopRestartingRef.current || audio.ended) {
          if (srcChangingRef.current) {
            logger.info(`[onPause:SKIP] reason=${loopRestartingRef.current ? 'loopRestarting' : 'ended'} | clearing srcChangingRef | currentTime=${audio.currentTime.toFixed(2)}`);
            srcChangingRef.current = false;
          } else {
            logger.info(`[onPause:SKIP] reason=${loopRestartingRef.current ? 'loopRestarting' : 'ended'} | currentTime=${audio.currentTime.toFixed(2)}`);
          }
          return;
        }
        if (srcChangingRef.current) {
          srcChangingRef.current = false;
          const state = usePlayerStore.getState();
          if (state.playerState.isPlaying && !state.remoteControl.active) {
            manageMediaSession.ensurePlaybackStatePlaying();
          }
          logger.info(`[onPause:SKIP] reason=srcChanging | ⚠️mediaSessionKeptPlaying=${state.playerState.isPlaying && !state.remoteControl.active}`);
          return;
        }
        if (effectPausingRef.current) {
          effectPausingRef.current = false;
          logger.info(`[onPause:SKIP] reason=effectPausing | currentTime=${audio.currentTime.toFixed(2)}`);
          return;
        }
        if (
          usePlayerStore.getState().playerState.isPlaying &&
          audio.error
        ) {
          logger.info(`[onPause:SKIP] reason=audioError | errorCode=${audio.error.code}`);
          return;
        }
        logger.info(`[onPause:FORWARD] currentTime=${audio.currentTime.toFixed(2)} | duration=${audio.duration?.toFixed(2)} | isPlaying_store=${usePlayerStore.getState().playerState.isPlaying}`);
        onPause?.(e);
      }}
      onEnded={(e) => {
        const state = usePlayerStore.getState();
        const loopState = state.playerState.loopState;
        const songlist = state.songlist;

        const userQueueRemaining = songlist.isInUserQueue
          ? songlist.userQueue.songs.length - 1
          : songlist.userQueue.songs.length;

        const hasNext = loopState === LoopState.One ? userQueueRemaining > 0 : false;

        logger.info(`[onEnded] loopState=${loopState} | hasNext=${hasNext} | songId=${songId} | currentTime=${e.currentTarget.currentTime.toFixed(2)} | duration=${e.currentTarget.duration?.toFixed(2)}`);

        // LoopState.One means repeat the current song indefinitely;
        // user queue songs are not advanced to in this mode.
        if (!hasNext && loopState === LoopState.One) {
          logger.info(`[onEnded → LoopRestartSync] songId=${songId} | loopRestartingRef=true | syncPlayHandledRef=true | currentTime→0 | calling safePlay`);
          loopRestartingRef.current = true;
          syncPlayHandledRef.current = true;
          e.currentTarget.currentTime = 0;
          safePlay(e.currentTarget, "LoopRestartSync");

          // Force refresh MediaSession metadata as some browsers clear it on ended
          if (state.songlist.currentSong) {
            manageMediaSession.setMediaSession(state.songlist.currentSong);
          }
        } else {
          if (state.songlist.currentSong) {
            manageMediaSession.setMediaSession(state.songlist.currentSong);
          }
          logger.info(`[onEnded → forward] reason=${hasNext ? 'hasNext' : 'notLoopOne'} | calling handleSongEnded`);
        }

        onEnded?.(e);
      }}
      playsInline
      preload="auto"
    />
  );
}
