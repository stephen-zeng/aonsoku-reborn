import { useMemo } from "react";
import { Slider } from "@/app/components/ui/slider";
import { useAudioSeeking } from "@/app/hooks/use-audio-seeking";
import {
  usePlayerBufferedProgress,
  usePlayerDuration,
  usePlayerIsBuffering,
  usePlayerProgress,
  usePlayerRef,
} from "@/store/player.store";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";
import { cn } from "@/lib/utils";

interface MiniPlayerProgressProps {
  showTime?: boolean;
  className?: string;
}

export function MiniPlayerProgress({
  showTime = true,
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

  return (
    <div className={cn("flex items-center flex-col w-full", className)}>
      {showTime && (
        <div className="w-full flex justify-between text-foreground/70">
          <div className="min-w-[40px] text-left text-[11px] font-light drop-shadow-md">
            {currentTime}
          </div>

          <div className="min-w-[40px] text-right text-[11px] font-light drop-shadow-md">
            {songDuration}
          </div>
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
        className={cn("w-full", showTime ? "h-4" : "h-3")}
        onValueChange={([value]) => handleSeeking(value)}
        onValueCommit={([value]) => handleSeeked(value)}
      />
    </div>
  );
}
