import clsx from "clsx";
import { ComponentPropsWithoutRef, RefObject, WheelEvent } from "react";
import { useTranslation } from "react-i18next";
import { VolumeIcon } from "@/app/components/icons/volume-icon";
import { Button } from "@/app/components/ui/button";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { Slider } from "@/app/components/ui/slider";
import { usePlayerHotkeys } from "@/app/hooks/use-audio-hotkeys";
import { useMuteToggle } from "@/app/hooks/use-mute-toggle";
import { useSystemVolume } from "@/app/hooks/use-system-volume";
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
  const { volume: playerVolume, handleVolumeWheel: handlePlayerWheel } =
    usePlayerVolume();
  const {
    volume: systemVolume,
    handleVolumeWheel: handleSystemWheel,
    supportsSystemVolumeControl,
  } = useSystemVolume();
  const { useAudioHotkeys } = usePlayerHotkeys();
  const { requiresSystemVolume } = getPlaybackCapabilities();

  const displayVolume = supportsSystemVolumeControl
    ? systemVolume
    : playerVolume;
  const isDisabled =
    (requiresSystemVolume && !supportsSystemVolumeControl) || disabled;

  useAudioHotkeys("mod+up", () => {
    if (supportsSystemVolumeControl) {
      handleSystemWheel(false);
    } else {
      handlePlayerWheel(false);
    }
  });
  useAudioHotkeys("mod+down", () => {
    if (supportsSystemVolumeControl) {
      handleSystemWheel(true);
    } else {
      handlePlayerWheel(true);
    }
  });

  const tooltipText =
    displayVolume === 0
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
  const { handleVolumeWheel: handlePlayerWheel } = usePlayerVolume();
  const { handleVolumeWheel: handleSystemWheel, supportsSystemVolumeControl } =
    useSystemVolume();

  function handleWheel(e: WheelEvent) {
    if (supportsSystemVolumeControl) {
      handleSystemWheel(e.deltaY > 0);
    } else {
      handlePlayerWheel(e.deltaY > 0);
    }
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
  const {
    volume: playerVolume,
    setVolume: setPlayerVolume,
    handleVolumeWheel: handlePlayerWheel,
  } = usePlayerVolume();
  const { min, max, step } = useVolumeSettings();
  const {
    volume: systemVolume,
    setSystemVolume,
    commitSystemVolume,
    handleVolumeWheel: handleSystemWheel,
    supportsSystemVolumeControl,
  } = useSystemVolume();
  const { requiresSystemVolume } = getPlaybackCapabilities();

  const displayVolume = supportsSystemVolumeControl
    ? systemVolume
    : playerVolume;
  const isDisabled =
    (requiresSystemVolume && !supportsSystemVolumeControl) || disabled;

  function handleWheel(e: WheelEvent) {
    if (supportsSystemVolumeControl) {
      handleSystemWheel(e.deltaY > 0);
    } else {
      handlePlayerWheel(e.deltaY > 0);
    }
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
      onValueChange={([value]) => {
        if (supportsSystemVolumeControl) {
          setSystemVolume(value);
        } else {
          setPlayerVolume(value);
        }
      }}
      onValueCommit={([value]) => {
        if (supportsSystemVolumeControl) {
          commitSystemVolume(value);
        }
      }}
      onWheel={handleWheel}
    />
  );
}
