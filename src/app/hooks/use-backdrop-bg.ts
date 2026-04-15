import { useMemo } from "react";
import { useSongColor } from "@/store/player.store";
import { hexToRgba } from "@/utils/getAverageColor";

export function useBackdropBg() {
  const { currentSongColor, currentSongColorIntensity } = useSongColor();
  return useMemo(() => {
    if (!currentSongColor) return undefined;
    return hexToRgba(currentSongColor, currentSongColorIntensity);
  }, [currentSongColor, currentSongColorIntensity]);
}
