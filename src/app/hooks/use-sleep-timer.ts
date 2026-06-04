import { useEffect, useRef } from "react";
import {
  getNativeAudioPluginAvailability,
  tryAddNativeAudioListener,
} from "@/native/audio/facade";
import { useSleepTimerStore } from "@/store/sleep-timer.store";
import { usePlayerStore } from "@/store/player.store";
import { getRuntime } from "@/utils/capabilities";

const NATIVE_RUNTIMES = new Set(["capacitor-ios", "capacitor-android"]);

export function useSleepTimer() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActive = useSleepTimerStore((s) => s.isActive);
  const mode = useSleepTimerStore((s) => s.mode);

  useEffect(() => {
    if (isActive && mode === "duration") {
      intervalRef.current = setInterval(() => {
        const state = useSleepTimerStore.getState();
        if (!state.isActive || state.mode !== "duration") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        state.tick();

        if (state.remainingSeconds <= 1) {
          usePlayerStore.getState().actions.setPlayingState(false);
          cancelSleepTimer();
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, mode]);

  useEffect(() => {
    const runtime = getRuntime();
    if (!NATIVE_RUNTIMES.has(runtime)) return;

    let handle: Awaited<ReturnType<typeof tryAddNativeAudioListener>> = null;

    tryAddNativeAudioListener("sleepTimerFired", () => {
      useSleepTimerStore.getState().cancelTimer();
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove();
    };
  }, []);
}

export function startSleepTimer(seconds: number) {
  const runtime = getRuntime();
  useSleepTimerStore.getState().startTimer(seconds);

  if (NATIVE_RUNTIMES.has(runtime)) {
    const availability = getNativeAudioPluginAvailability();
    if (availability.available) {
      availability.plugin.setSleepTimer({ seconds, mode: "duration" });
    }
  }
}

export function startEndOfTrackTimer() {
  const runtime = getRuntime();
  useSleepTimerStore.getState().startEndOfTrack();

  if (NATIVE_RUNTIMES.has(runtime)) {
    const availability = getNativeAudioPluginAvailability();
    if (availability.available) {
      availability.plugin.setSleepTimer({ seconds: 0, mode: "endOfTrack" });
    }
  }
}

export function cancelSleepTimer() {
  const runtime = getRuntime();
  useSleepTimerStore.getState().cancelTimer();

  if (NATIVE_RUNTIMES.has(runtime)) {
    const availability = getNativeAudioPluginAvailability();
    if (availability.available) {
      availability.plugin.cancelSleepTimer();
    }
  }
}
