import { useMemo } from "react";
import { Slider } from "@/app/components/ui/slider";
import { useAudioSeeking } from "@/app/hooks/use-audio-seeking";
import { cn } from "@/lib/utils";
import {
  usePlayerBufferedProgress,
  usePlayerDuration,
  usePlayerIsBuffering,
  usePlayerProgress,
  usePlayerRef,
} from "@/store/player.store";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";

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
  const progress = usePlayerProgress();
  const bufferedProgress = usePlayerBufferedProgress();
  const audioPlayerRef = usePlayerRef();
  const currentDuration = usePlayerDuration();
  const isBuffering = usePlayerIsBuffering();

  const audioRef = useMemo(
    () => ({ current: audioPlayerRef }),
    [audioPlayerRef],
  );

  const { localProgress, isLocalSeeking, handleSeeking, handleSeeked } =
    useAudioSeeking({ audioRef });

  const currentTime = convertSecondsToTime(
    isLocalSeeking ? localProgress : progress,
  );

  const songDuration = useMemo(
    () => convertSecondsToTime(currentDuration ?? 0),
    [currentDuration],
  );

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
        bufferedProgress={bufferedProgress}
        hideThumb
        defaultValue={[0]}
        value={isLocalSeeking ? [localProgress] : [progress]}
        max={currentDuration}
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
