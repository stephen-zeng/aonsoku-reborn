import { Volume2, VolumeX } from "lucide-react";
import { VolumeSlider } from "@/app/components/player/volume";
import { isIOS } from "@/utils/platform";

export function MiniPlayerVolume() {
  if (isIOS()) {
    return (
      <div className="flex justify-between items-center gap-2 text-foreground/70">
        <VolumeX className="w-6 h-6 drop-shadow-lg" strokeWidth={1.75} />
        <span className="text-xs font-medium tabular-nums">100%</span>
        <Volume2 className="w-6 h-6 drop-shadow-lg" strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <div className="flex justify-between items-center gap-2 text-foreground/70">
      <VolumeX className="w-6 h-6 drop-shadow-lg" strokeWidth={1.75} />

      <VolumeSlider variant="secondary" className="w-full" />

      <Volume2 className="w-6 h-6 drop-shadow-lg" strokeWidth={1.75} />
    </div>
  );
}
