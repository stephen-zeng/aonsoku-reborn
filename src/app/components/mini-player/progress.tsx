import { useCallback, useEffect, useState } from "react";
import { Slider } from "@/app/components/ui/slider";
import { cn } from "@/lib/utils";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";
import { useMiniPlayerContext } from "./context";

interface MiniPlayerProgressProps {
  showTime?: boolean;
  compact?: boolean;
  className?: string;
}

export function MiniPlayerProgress({
  showTime = true,
  compact = false,
  className,
}: MiniPlayerProgressProps) {
  const { state, actions } = useMiniPlayerContext();

  const progress = state?.progress ?? 0;
  const currentDuration = state?.duration ?? 0;
  const isBuffering = state?.isBuffering ?? false;

  const [localProgress, setLocalProgress] = useState(progress);
  const [isLocalSeeking, setIsLocalSeeking] = useState(false);

  useEffect(() => {
    if (!isLocalSeeking) {
      setLocalProgress(progress);
    }
  }, [progress, isLocalSeeking]);

  const handleSeeking = useCallback((value: number) => {
    setIsLocalSeeking(true);
    setLocalProgress(value);
  }, []);

  const handleSeeked = useCallback(
    (value: number) => {
      setIsLocalSeeking(false);
      actions.seek(value);
    },
    [actions],
  );

  const currentTime = convertSecondsToTime(localProgress);
  const songDuration = convertSecondsToTime(currentDuration);

  const timeClass = compact
    ? "text-[10px] font-light tabular-nums whitespace-nowrap"
    : "min-w-[40px] text-[11px] font-light drop-shadow-md";

  return (
    <div
      className={cn(
        compact
          ? "grid grid-cols-[auto_1fr_auto] items-center gap-2 w-full"
          : "flex items-center flex-col w-full",
        className,
      )}
    >
      {showTime && compact && (
        <div className={cn(timeClass, "text-right text-foreground/70")}>
          {currentTime}
        </div>
      )}

      {showTime && !compact && (
        <div className="w-full flex justify-between text-foreground/70">
          <div className={cn(timeClass, "text-left")}>{currentTime}</div>
          <div className={cn(timeClass, "text-right")}>{songDuration}</div>
        </div>
      )}

      <Slider
        variant="secondary"
        isBuffering={isBuffering}
        hideThumb
        defaultValue={[0]}
        value={[localProgress]}
        max={currentDuration || 1}
        step={1}
        className={cn("w-full", !compact && showTime ? "h-4" : "h-3")}
        onValueChange={([value]) => handleSeeking(value)}
        onValueCommit={([value]) => handleSeeked(value)}
      />

      {showTime && compact && (
        <div className={cn(timeClass, "text-left text-foreground/70")}>
          {songDuration}
        </div>
      )}
    </div>
  );
}
