import { useCallback, useEffect, useRef, type WheelEvent } from "react";
import { VolumeIcon } from "@/app/components/icons/volume-icon";
import { Button } from "@/app/components/ui/button";
import { Slider } from "@/app/components/ui/slider";
import { usePlayerVolume, useVolumeSettings } from "@/store/player.store";

export function MobileVolumeBar() {
  const { volume, setVolume, handleVolumeWheel } = usePlayerVolume();
  const { min, max, step } = useVolumeSettings();
  const lastVolumeRef = useRef(volume > 0 ? volume : 100);

  const handleMuteClick = useCallback(() => {
    if (volume === 0) {
      setVolume(lastVolumeRef.current);
    } else {
      lastVolumeRef.current = volume;
      setVolume(0);
    }
  }, [volume, setVolume]);

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      handleVolumeWheel(e.deltaY > 0);
    },
    [handleVolumeWheel],
  );

  useEffect(() => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
    }
  }, [volume]);

  return (
    <div className="flex items-center gap-2 w-full" onWheel={handleWheel}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 p-0 shrink-0 hover:bg-foreground/10"
        onClick={handleMuteClick}
      >
        <VolumeIcon volume={volume} size={16} className="text-foreground/70" />
      </Button>
      <Slider
        variant="secondary"
        value={[volume]}
        min={min}
        max={max}
        step={step}
        className="w-full h-3"
        onValueChange={([value]) => setVolume(value)}
      />
      <VolumeIcon
        volume={100}
        size={16}
        className="text-foreground/70 shrink-0"
      />
    </div>
  );
}
