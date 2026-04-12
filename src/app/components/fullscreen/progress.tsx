import { useCallback, useEffect, useState } from "react";
import { ProgressSlider } from "@/app/components/ui/slider";
import {
  usePlayerActions,
  usePlayerDuration,
  usePlayerProgress,
  usePlayerRef,
} from "@/store/player.store";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";

export function FullscreenProgress() {
  const progress = usePlayerProgress();
  const [localProgress, setLocalProgress] = useState(progress);
  const [isSeeking, setIsSeeking] = useState(false);
  const audioPlayerRef = usePlayerRef();
  const currentDuration = usePlayerDuration();
  const { setProgress } = usePlayerActions();

  useEffect(() => {
    if (!isSeeking) {
      setLocalProgress(progress);
    }
  }, [progress, isSeeking]);

  const updateAudioCurrentTime = useCallback(
    (value: number) => {
      if (audioPlayerRef) {
        audioPlayerRef.currentTime = value;
      }
    },
    [audioPlayerRef],
  );

  const handleSeeking = useCallback((amount: number) => {
    setIsSeeking(true);
    setLocalProgress(amount);
  }, []);

  const handleSeeked = useCallback(
    (amount: number) => {
      setIsSeeking(false);
      updateAudioCurrentTime(amount);
      setProgress(amount);
      setLocalProgress(amount);
    },
    [setProgress, updateAudioCurrentTime],
  );

  const handleSeekedFallback = useCallback(() => {
    if (isSeeking) {
      setIsSeeking(false);
      if (localProgress !== progress) {
        updateAudioCurrentTime(localProgress);
        setProgress(localProgress);
      }
    }
  }, [isSeeking, localProgress, progress, setProgress, updateAudioCurrentTime]);

  const currentTime = convertSecondsToTime(
    isSeeking ? localProgress : progress,
  );

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full">
      <div className="min-w-[36px] sm:min-w-[42px] text-right tabular-nums text-xs sm:text-sm text-foreground/70">
        {currentTime}
      </div>

      <ProgressSlider
        variant="secondary"
        defaultValue={[0]}
        value={isSeeking ? [localProgress] : [progress]}
        tooltipTransformer={convertSecondsToTime}
        max={currentDuration}
        step={1}
        className="w-full h-2 sm:h-3"
        onValueChange={([value]) => handleSeeking(value)}
        onValueCommit={([value]) => handleSeeked(value)}
        onPointerUp={handleSeekedFallback}
        onMouseUp={handleSeekedFallback}
        onTouchEnd={handleSeekedFallback}
        data-vaul-no-drag
      />

      <div className="min-w-[36px] sm:min-w-[42px] text-left tabular-nums text-xs sm:text-sm text-foreground/70">
        {convertSecondsToTime(currentDuration ?? 0)}
      </div>
    </div>
  );
}
