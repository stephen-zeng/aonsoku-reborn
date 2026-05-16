import clsx from "clsx";
import { ComponentPropsWithoutRef, RefObject, WheelEvent } from "react";
import { useTranslation } from "react-i18next";
import { VolumeIcon } from "@/app/components/icons/volume-icon";
import { Button } from "@/app/components/ui/button";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { Slider } from "@/app/components/ui/slider";
import { usePlayerHotkeys } from "@/app/hooks/use-audio-hotkeys";
import { useMuteToggle } from "@/app/hooks/use-mute-toggle";
import { cn } from "@/lib/utils";
import { usePlayerVolume, useVolumeSettings } from "@/store/player.store";
import { getPlaybackCapabilities } from "@/utils/capabilities";
import { PopoverVolume } from "./popover-volume";

interface PlayerVolumeProps {
  disabled: boolean;
  audioRef: RefObject<HTMLAudioElement>;
}

export function PlayerVolume({ disabled, audioRef }: PlayerVolumeProps) {
  const { t } = useTranslation();
  const { volume, handleVolumeWheel } = usePlayerVolume();
  const { useAudioHotkeys } = usePlayerHotkeys();
  const { requiresSystemVolume } = getPlaybackCapabilities();
  const displayVolume = requiresSystemVolume ? 100 : volume;
  const isDisabled = requiresSystemVolume || disabled;

  useAudioHotkeys("mod+up", () => handleVolumeWheel(false));
  useAudioHotkeys("mod+down", () => handleVolumeWheel(true));

  const tooltipText =
    volume === 0
      ? t("player.tooltips.volume.unmute")
      : t("player.tooltips.volume.mute");

  return (
    <div className={clsx(isDisabled && "opacity-50")}>
      <div className="flex 2xl:hidden">
        <PopoverVolume>
          <VolumeIcon volume={displayVolume} size={18} />
        </PopoverVolume>
      </div>

      <div className="hidden 2xl:flex gap-2 pr-2 items-center">
        <SimpleTooltip text={tooltipText} disabled={isDisabled}>
          <div className="h-10 flex items-center">
            <MuteButton disabled={isDisabled}>
              <div className="text-secondary-foreground">
                <VolumeIcon volume={displayVolume} size={18} />
              </div>
            </MuteButton>
          </div>
        </SimpleTooltip>
        <VolumeSlider disabled={isDisabled} />
      </div>
    </div>
  );
}

type MuteButtonProps = ComponentPropsWithoutRef<typeof Button>;

export function MuteButton({ className, ...props }: MuteButtonProps) {
  const { handleMuteClick } = useMuteToggle();
  const { handleVolumeWheel } = usePlayerVolume();

  function handleWheel(e: WheelEvent) {
    handleVolumeWheel(e.deltaY > 0);
  }

  return (
    <Button
      {...props}
      variant="ghost"
      size="icon"
      className={cn("p-1 w-7 h-7 hover-supported:bg-transparent", className)}
      onClick={handleMuteClick}
      onWheel={handleWheel}
      unfocusable
    />
  );
}

type VolumeSliderProps = ComponentPropsWithoutRef<typeof Slider>;

export function VolumeSlider({
  disabled,
  className,
  ...props
}: VolumeSliderProps) {
  const { volume, setVolume, handleVolumeWheel } = usePlayerVolume();
  const { min, max, step } = useVolumeSettings();
  const { requiresSystemVolume } = getPlaybackCapabilities();
  const displayVolume = requiresSystemVolume ? 100 : volume;
  const isDisabled = requiresSystemVolume || disabled;

  function handleWheel(e: WheelEvent) {
    handleVolumeWheel(e.deltaY > 0);
  }

  return (
    <Slider
      className={cn(
        "cursor-pointer w-32",
        className,
        isDisabled && "pointer-events-none opacity-50",
      )}
      data-testid="player-volume-slider"
      {...props}
      value={[displayVolume]}
      min={min}
      max={max}
      step={step}
      disabled={isDisabled}
      onValueChange={([value]) => setVolume(value)}
      onWheel={handleWheel}
    />
  );
}
