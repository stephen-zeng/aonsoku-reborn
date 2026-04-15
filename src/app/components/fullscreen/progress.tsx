import { useCallback, useEffect, useState } from "react";
import { ProgressSlider } from "@/app/components/ui/slider";
import {
  usePlayerActions,
  usePlayerDuration,
  usePlayerProgress,
  usePlayerRef,
} from "@/store/player.store";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";

const STACKED_TIME_LABEL_CLASS = "tabular-nums text-foreground/50 text-xs";

export function FullscreenProgress({
  thin = false,
  stacked = false,
}: {
  thin?: boolean;
  stacked?: boolean;
}) {
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

  const sliderProps = {
    variant: "secondary" as const,
    defaultValue: [0] as [number],
    value: (isSeeking ? [localProgress] : [progress]) as [number],
    max: currentDuration,
    step: 1,
    className: "w-full h-2 sm:h-3",
    onValueChange: ([value]: [number]) => handleSeeking(value),
    onValueCommit: ([value]: [number]) => handleSeeked(value),
    onPointerUp: handleSeekedFallback,
    onMouseUp: handleSeekedFallback,
    onTouchEnd: handleSeekedFallback,
    "data-vaul-no-drag": true,
  };

  if (stacked) {
    return (
      <div className="w-full">
        <ProgressSlider {...sliderProps} />
        <div className="flex justify-between mt-1">
          <div className={STACKED_TIME_LABEL_CLASS}>{currentTime}</div>
          <div className={STACKED_TIME_LABEL_CLASS}>
            {convertSecondsToTime(currentDuration ?? 0)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full">
      <div
        className={`min-w-[36px] sm:min-w-[42px] text-right tabular-nums text-foreground/70 ${
          thin ? "text-xs" : "text-xs sm:text-sm"
        }`}
      >
        {currentTime}
      </div>

      <ProgressSlider {...sliderProps} />

      <div
        className={`min-w-[36px] sm:min-w-[42px] text-left tabular-nums text-foreground/70 ${
          thin ? "text-xs" : "text-xs sm:text-sm"
        }`}
      >
        {convertSecondsToTime(currentDuration ?? 0)}
      </div>
    </div>
  );
}
