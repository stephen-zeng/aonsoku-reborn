import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getNativeAudioPluginAvailability } from "@/native/audio/facade";
import { getPlaybackCapabilities } from "@/utils/capabilities";

const volumeListeners = new Set<() => void>();
let systemVolume = 100;
let isListenerStarted = false;
let isDragging = false;

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function volumeFromNative(value: number) {
  return clampVolume(value * 100);
}

function emitSystemVolume(value: number) {
  const nextVolume = clampVolume(value);
  if (nextVolume === systemVolume) return;

  systemVolume = nextVolume;
  for (const listener of volumeListeners) {
    listener();
  }
}

function emitFromNative(value: number) {
  if (isDragging) return;
  emitSystemVolume(value);
}

function subscribeToSystemVolume(listener: () => void) {
  volumeListeners.add(listener);
  return () => {
    volumeListeners.delete(listener);
  };
}

function getSystemVolumeSnapshot() {
  return systemVolume;
}

function canUseSystemVolumeControl() {
  if (!getPlaybackCapabilities().supportsSystemVolumeControl) return false;
  return getNativeAudioPluginAvailability().available;
}

function refreshSystemVolume() {
  const availability = getNativeAudioPluginAvailability();
  if (!availability.available) return Promise.resolve();

  return availability.plugin
    .getSystemVolume()
    .then(({ volume }) => {
      emitSystemVolume(volumeFromNative(volume));
    })
    .catch(() => undefined);
}

function startSystemVolumeListener() {
  if (isListenerStarted) return;

  const availability = getNativeAudioPluginAvailability();
  if (!availability.available) return;

  isListenerStarted = true;
  refreshSystemVolume();

  availability.plugin
    .addListener("systemVolumeChanged", (event) => {
      emitFromNative(volumeFromNative(event.volume));
    })
    .catch(() => {
      isListenerStarted = false;
    });
}

export function useSystemVolume() {
  const supportsSystemVolumeControl = canUseSystemVolumeControl();
  const volume = useSyncExternalStore(
    subscribeToSystemVolume,
    getSystemVolumeSnapshot,
    getSystemVolumeSnapshot,
  );

  useEffect(() => {
    if (!supportsSystemVolumeControl) return;
    startSystemVolumeListener();
  }, [supportsSystemVolumeControl]);

  const setSystemVolume = useCallback(
    (value: number) => {
      if (!supportsSystemVolumeControl) return;

      const availability = getNativeAudioPluginAvailability();
      if (!availability.available) return;

      const clamped = clampVolume(value);
      isDragging = true;
      emitSystemVolume(clamped);

      availability.plugin
        .setSystemVolume({ value: clamped / 100 })
        .catch(() => undefined);
    },
    [supportsSystemVolumeControl],
  );

  const commitSystemVolume = useCallback(
    (value: number) => {
      isDragging = false;
      if (!supportsSystemVolumeControl) return;

      const availability = getNativeAudioPluginAvailability();
      if (!availability.available) return;

      const clamped = clampVolume(value);
      emitSystemVolume(clamped);

      availability.plugin
        .setSystemVolume({ value: clamped / 100 })
        .then(({ volume }) => {
          emitSystemVolume(volumeFromNative(volume));
        })
        .catch(() => {
          refreshSystemVolume();
        });
    },
    [supportsSystemVolumeControl],
  );

  const handleVolumeWheel = useCallback(
    (isScrollingDown: boolean) => {
      const next = isScrollingDown
        ? Math.max(0, volume - 5)
        : Math.min(100, volume + 5);

      commitSystemVolume(next);
    },
    [commitSystemVolume, volume],
  );

  return {
    volume,
    setSystemVolume,
    commitSystemVolume,
    handleVolumeWheel,
    supportsSystemVolumeControl,
  };
}
