import { useCallback, useEffect, useRef } from "react";
import {
  AudioContext,
  type IAudioContext,
  type IGainNode,
  type IMediaElementAudioSourceNode,
} from "standardized-audio-context";
import { logger } from "@/utils/logger";
import { ReplayGainParams } from "@/utils/replayGain";

type IAudioSource = IMediaElementAudioSourceNode<IAudioContext>;

interface UseAudioContextOptions {
  enabled: boolean;
  onSetupError?: () => void;
}

export function useAudioContext(
  audio: HTMLAudioElement | null,
  { enabled, onSetupError }: UseAudioContextOptions,
) {
  const audioContextRef = useRef<IAudioContext | null>(null);
  const sourceNodeRef = useRef<IAudioSource | null>(null);
  const gainNodeRef = useRef<IGainNode<IAudioContext> | null>(null);

  const resetRefs = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const handleSetupError = useCallback(
    (error: unknown, contextLabel: string) => {
      logger.error(
        `Failed to setup AudioContext during ${contextLabel}`,
        error,
      );
      resetRefs();
      onSetupError?.();
    },
    [onSetupError, resetRefs],
  );

  const setupAudioContext = useCallback(() => {
    if (!enabled) {
      return;
    }

    if (!audio) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      // If the audio element changed, disconnect the old source node
      // (createMediaElementSource can only be called once per element)
      if (
        sourceNodeRef.current &&
        sourceNodeRef.current.mediaElement !== audio
      ) {
        sourceNodeRef.current.disconnect();
        sourceNodeRef.current = null;
      }

      if (!sourceNodeRef.current) {
        sourceNodeRef.current = audioContext.createMediaElementSource(audio);
      }

      if (!gainNodeRef.current) {
        gainNodeRef.current = audioContext.createGain();
        // First we need to connect the sourceNode to the gainNode
        sourceNodeRef.current.connect(gainNodeRef.current);
        // And then we can connect the gainNode to the destination
        gainNodeRef.current.connect(audioContext.destination);
      }
    } catch (error) {
      handleSetupError(error, "setupAudioContext");
    }
  }, [audio, enabled, handleSetupError]);

  const resumeContext = useCallback(async () => {
    if (!enabled) return;

    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    logger.info("AudioContext State", { state: audioContext.state });

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
        logger.info("AudioContext resumed successfully");
      } catch (error) {
        logger.error("Failed to resume AudioContext", error);
      }
    }
    if (audioContext.state === "closed") {
      resetRefs();
      setupAudioContext();
    }
  }, [enabled, resetRefs, setupAudioContext]);

  const setupGain = useCallback(
    (gainValue: number, replayGain?: ReplayGainParams) => {
      if (!enabled) return;

      if (audioContextRef.current && gainNodeRef.current) {
        const currentTime = audioContextRef.current.currentTime;

        logger.info("Replay Gain Status", {
          enabled,
          gainValue,
          ...replayGain,
        });

        gainNodeRef.current.gain.cancelScheduledValues(currentTime);
        gainNodeRef.current.gain.setValueAtTime(
          gainNodeRef.current.gain.value,
          currentTime,
        );
        gainNodeRef.current.gain.linearRampToValueAtTime(
          gainValue,
          currentTime + 0.05,
        );
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) {
      resetRefs();
      return;
    }

    if (audio) setupAudioContext();
  }, [audio, enabled, resetRefs, setupAudioContext]);

  // Handle visibility changes to keep AudioContext alive
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      // When page becomes visible again, resume the context if suspended
      if (!document.hidden && audioContext.state === "suspended") {
        try {
          await audioContext.resume();
          logger.info("AudioContext resumed after visibility change");
        } catch (error) {
          logger.error(
            "Failed to resume AudioContext on visibility change",
            error,
          );
        }
      }
    };

    if (!enabled) return;

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear state after unmount
  useEffect(() => {
    return () => resetRefs();
  }, []);

  return {
    audioContextRef,
    sourceNodeRef,
    gainNodeRef,
    setupAudioContext,
    resumeContext,
    setupGain,
    resetRefs,
  };
}
