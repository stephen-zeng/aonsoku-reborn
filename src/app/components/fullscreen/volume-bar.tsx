import { useCallback, useRef, type WheelEvent } from "react";
import { useTranslation } from "react-i18next";
import { VolumeIcon } from "@/app/components/icons/volume-icon";
import { Button } from "@/app/components/ui/button";
import { Slider } from "@/app/components/ui/slider";
import { useFullscreenContrast } from "@/app/hooks/use-fullscreen-contrast";
import { useMuteToggle } from "@/app/hooks/use-mute-toggle";
import { usePlayerVolume, useVolumeSettings } from "@/store/player.store";
import { getPlaybackCapabilities } from "@/utils/capabilities";

export function VolumeBar() {
  const { volume, handleMuteClick } = useMuteToggle();
  const { setVolume, handleVolumeWheel } = usePlayerVolume();
  const { min, max, step } = useVolumeSettings();
  const wheelRafRef = useRef<number | null>(null);
  const { t } = useTranslation();
  const { requiresSystemVolume } = getPlaybackCapabilities();
  const displayVolume = requiresSystemVolume ? 100 : volume;
  const { hoverBg10 } = useFullscreenContrast();

  const handleWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      if (requiresSystemVolume || wheelRafRef.current !== null) return;
      wheelRafRef.current = requestAnimationFrame(() => {
        handleVolumeWheel(e.deltaY > 0);
        wheelRafRef.current = null;
      });
    },
    [handleVolumeWheel, requiresSystemVolume],
  );

  return (
    <div
      className="flex w-full min-w-0 items-center gap-2"
      data-testid="fullscreen-volume-bar"
      onWheel={handleWheel}
    >
      <Button
        variant="ghost"
        size="icon"
        className={`size-8 p-0 shrink-0 ${hoverBg10}`}
        onClick={handleMuteClick}
        disabled={requiresSystemVolume}
        aria-label={
          volume === 0
            ? t("player.tooltips.volume.unmute")
            : t("player.tooltips.volume.mute")
        }
      >
        <VolumeIcon
          volume={displayVolume}
          size={16}
          className="text-foreground/70"
        />
      </Button>
      <Slider
        variant="secondary"
        value={[displayVolume]}
        min={min}
        max={max}
        step={step}
        className="h-3 w-full min-w-0"
        onValueChange={([value]) => setVolume(value)}
        disabled={requiresSystemVolume}
        aria-label={t("player.tooltips.volume.mute")}
      />
      <VolumeIcon
        volume={100}
        size={16}
        className="text-foreground/70 shrink-0"
      />
    </div>
  );
}
