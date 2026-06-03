import { useCallback, useEffect, useState } from "react";
import { Slider } from "@/app/components/ui/slider";
import { cn } from "@/lib/utils";
import { useMiniPlayerContext } from "./context";

interface MiniPlayerVolumeSliderProps {
  className?: string;
}

export function MiniPlayerVolumeSlider({
  className,
}: MiniPlayerVolumeSliderProps) {
  const { state, actions } = useMiniPlayerContext();
  const volume = state?.volume ?? 100;

  const [localVolume, setLocalVolume] = useState(volume);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  const handleChange = useCallback(
    ([value]: number[]) => {
      setLocalVolume(value);
      actions.setVolume(value);
    },
    [actions],
  );

  return (
    <Slider
      variant="secondary"
      className={cn("w-full", className)}
      value={[localVolume]}
      max={100}
      step={1}
      onValueChange={handleChange}
      onValueCommit={handleChange}
    />
  );
}
