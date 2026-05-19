import { useCallback, useEffect, useRef, useState } from "react";
import {
  AonsokuNativeAudio,
  getNativeAudioPluginAvailability,
} from "@/native/audio/facade";
import { getPlaybackCapabilities } from "@/utils/capabilities";

export function useSystemVolume() {
  const { supportsSystemVolumeControl } = getPlaybackCapabilities();
  const [volume, setVolume] = useState(100);
  const isSettingRef = useRef(false);

  useEffect(() => {
    if (!supportsSystemVolumeControl) return;

    const availability = getNativeAudioPluginAvailability();
    if (!availability.available) return;

    availability.plugin.getSystemVolume().then(({ volume }) => {
      setVolume(Math.round(volume * 100));
    });

    let handle: { remove: () => void } | null = null;
    AonsokuNativeAudio.addListener("systemVolumeChanged", (event) => {
      if (!isSettingRef.current) {
        setVolume(Math.round(event.volume * 100));
      }
    }).then((h) => {
      handle = h;
    });

    return () => {
      handle?.remove();
    };
  }, [supportsSystemVolumeControl]);

  const setSystemVolume = useCallback(
    (value: number) => {
      if (!supportsSystemVolumeControl) return;

      const availability = getNativeAudioPluginAvailability();
      if (!availability.available) return;

      const clamped = Math.max(0, Math.min(100, value));
      setVolume(clamped);
      isSettingRef.current = true;

      availability.plugin
        .setSystemVolume({ value: clamped / 100 })
        .finally(() => {
          isSettingRef.current = false;
        });
    },
    [supportsSystemVolumeControl],
  );

  const handleVolumeWheel = useCallback(
    (isScrollingDown: boolean) => {
      setVolume((prev) => {
        const next = isScrollingDown
          ? Math.max(0, prev - 5)
          : Math.min(100, prev + 5);
        setSystemVolume(next);
        return next;
      });
    },
    [setSystemVolume],
  );

  return { volume, setSystemVolume, handleVolumeWheel, supportsSystemVolumeControl };
}
