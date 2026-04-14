import { useMemo } from "react";
import { useSongColor } from "@/store/player.store";
import { hexToRgba } from "@/utils/getAverageColor";

export function FullscreenBackdrop() {
  return <DynamicColorBackdrop />;
}

function DynamicColorBackdrop() {
  const { currentSongColor, currentSongColorIntensity } = useSongColor();

  const backgroundColor = useMemo(() => {
    if (!currentSongColor) return undefined;
    return hexToRgba(currentSongColor, currentSongColorIntensity);
  }, [currentSongColor, currentSongColorIntensity]);

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
      <div
        className="w-full h-full transition-[background-color] duration-1000"
        style={{ backgroundColor }}
      />
    </div>
  );
}
