import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ProgressSlider } from "@/app/components/ui/slider";
import { useAudioSeeking } from "@/app/hooks/use-audio-seeking";
import {
  usePlayerDuration,
  usePlayerIsBuffering,
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
  const audioPlayerRef = usePlayerRef();
  const currentDuration = usePlayerDuration();
  const isBuffering = usePlayerIsBuffering();
  const { t } = useTranslation();

  const audioRef = useMemo(
    () => ({ current: audioPlayerRef }),
    [audioPlayerRef],
  );
  const {
    localProgress,
    isLocalSeeking: isSeeking,
    handleSeeking,
    handleSeeked,
    handleSeekedFallback,
  } = useAudioSeeking({ audioRef });

  const currentTime = convertSecondsToTime(
    isSeeking ? localProgress : progress,
  );

  const songDuration = useMemo(
    () => convertSecondsToTime(currentDuration ?? 0),
    [currentDuration],
  );

  const sliderProps = {
    variant: "secondary" as const,
    defaultValue: [0] as [number],
    value: (isSeeking ? [localProgress] : [progress]) as [number],
    max: currentDuration ?? 0,
    step: 1,
    isBuffering,
    className: "w-full h-2 sm:h-3",
    onValueChange: ([value]: [number]) => handleSeeking(value),
    onValueCommit: ([value]: [number]) => handleSeeked(value),
    onPointerUp: handleSeekedFallback,
    onMouseUp: handleSeekedFallback,
    onTouchEnd: handleSeekedFallback,
    "data-vaul-no-drag": true,
    "aria-label": t("player.tooltips.progress"),
  };

  if (stacked) {
    return (
      <div className="w-full">
        <ProgressSlider {...sliderProps} />
        <div className="flex justify-between mt-1">
          <div className={STACKED_TIME_LABEL_CLASS}>{currentTime}</div>
          <div className={STACKED_TIME_LABEL_CLASS}>{songDuration}</div>
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
        {songDuration}
      </div>
    </div>
  );
}
