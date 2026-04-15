import { useMemo, useRef } from "react";
import { usePlayerStore } from "@/store/player.store";
import { hexToRgb } from "@/utils/getAverageColor";

const selectBackdropState = (state: {
  settings: {
    colors: {
      currentSongColor: string | null;
      currentSongColorIntensity: number;
    };
  };
}) => ({
  currentSongColor: state.settings.colors.currentSongColor,
  currentSongColorIntensity: state.settings.colors.currentSongColorIntensity,
});

export function useBackdropStyle() {
  const { currentSongColor, currentSongColorIntensity } =
    usePlayerStore(selectBackdropState);
  const lastRgbRef = useRef<[number, number, number]>([0, 0, 0]);

  return useMemo(() => {
    if (currentSongColor) {
      const rgb = hexToRgb(currentSongColor);
      if (rgb) {
        lastRgbRef.current = rgb as [number, number, number];
      }
    }

    const [r, g, b] = lastRgbRef.current;
    const alpha = currentSongColor ? currentSongColorIntensity : 0;

    return {
      "--queue-backdrop-r": r,
      "--queue-backdrop-g": g,
      "--queue-backdrop-b": b,
      "--queue-backdrop-alpha": alpha,
    } as React.CSSProperties;
  }, [currentSongColor, currentSongColorIntensity]);
}
