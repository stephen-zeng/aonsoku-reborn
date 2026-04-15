import { useMemo } from "react";
import { Slider } from "@/app/components/ui/slider";
import { useAudioSeeking } from "@/app/hooks/use-audio-seeking";
import {
  usePlayerDuration,
  usePlayerIsBuffering,
  usePlayerProgress,
  usePlayerRef,
} from "@/store/player.store";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";

export function MiniPlayerProgress() {
  const progress = usePlayerProgress();
  const audioPlayerRef = usePlayerRef();
  const currentDuration = usePlayerDuration();
  const isBuffering = usePlayerIsBuffering();

  const audioRef = { current: audioPlayerRef };

  const {
    localProgress,
    isLocalSeeking,
    handleSeeking,
    handleSeeked,
    handleSeekedFallback,
  } = useAudioSeeking({ audioRef });

  const currentTime = convertSecondsToTime(
    isLocalSeeking ? localProgress : progress,
  );

  const songDuration = useMemo(
    () => convertSecondsToTime(currentDuration ?? 0),
    [currentDuration],
  );

  return (
    <div className="flex items-center flex-col">
      <div className="w-full flex justify-between text-foreground/70">
        <div className="min-w-[40px] text-left text-[11px] font-light drop-shadow-md">
          {currentTime}
        </div>

        <div className="min-w-[40px] text-right text-[11px] font-light drop-shadow-md">
          {songDuration}
        </div>
      </div>

      <Slider
        variant="secondary"
        isBuffering={isBuffering}
        defaultValue={[0]}
        value={isLocalSeeking ? [localProgress] : [progress]}
        max={currentDuration}
        step={1}
        className="w-full h-4"
        onValueChange={([value]) => handleSeeking(value)}
        onValueCommit={([value]) => handleSeeked(value)}
        onPointerUp={handleSeekedFallback}
        onMouseUp={handleSeekedFallback}
      />
    </div>
  );
}
