import clsx from "clsx";
import { RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import { ProgressSlider } from "@/app/components/ui/slider";
import { useAudioSeeking } from "@/app/hooks/use-audio-seeking";
import { subsonic } from "@/service/subsonic";
import {
  usePlayerDuration,
  usePlayerIsBuffering,
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerProgress,
  usePlayerSonglist,
} from "@/store/player.store";
import { convertSecondsToTime } from "@/utils/convertSecondsToTime";

interface PlayerProgressProps {
  audioRef: RefObject<HTMLAudioElement>;
}

export function PlayerProgress({ audioRef }: PlayerProgressProps) {
  const progress = usePlayerProgress();
  const currentDuration = usePlayerDuration();
  const isPlaying = usePlayerIsPlaying();
  const isBuffering = usePlayerIsBuffering();
  const { currentSong, currentList } = usePlayerSonglist();
  const { isSong } = usePlayerMediaType();

  const isEmpty = isSong && currentList.length === 0;

  const {
    localProgress,
    isLocalSeeking,
    setIsLocalSeeking,
    handleSeeking,
    handleSeeked,
    handleSeekedFallback,
  } = useAudioSeeking({ audioRef });

  // Sync local progress with global progress when not seeking
  useEffect(() => {
    if (!isLocalSeeking) {
      setIsLocalSeeking(false);
    }
  }, [isLocalSeeking, setIsLocalSeeking]);

  const isScrobbleSentRef = useRef(false);
  const isNowPlayingSentRef = useRef(false);

  const sendScrobble = useCallback(async (songId: string) => {
    await subsonic.scrobble.send(songId);
  }, []);

  const progressTicks = useRef(0);

  useEffect(() => {
    if (isLocalSeeking || !isPlaying) {
      return;
    }
    const isRemoteControlActive = !audioRef.current;

    if (isRemoteControlActive || !isSong) return;

    const progressPercentage = (progress / currentDuration) * 100;

    if (progressPercentage === 0) {
      isScrobbleSentRef.current = false;
      progressTicks.current = 0;
    } else {
      progressTicks.current += 1;

      if (
        (progressTicks.current >= currentDuration / 2 ||
          progressTicks.current >= 60 * 4) &&
        !isScrobbleSentRef.current
      ) {
        sendScrobble(currentSong.id);
        isScrobbleSentRef.current = true;
      }
    }
  }, [
    progress,
    currentDuration,
    isSong,
    currentSong.id,
    isPlaying,
    isLocalSeeking,
    audioRef,
    sendScrobble,
  ]);

  useEffect(() => {
    if (!currentSong?.id) return;
    const isRemoteControlActive = !audioRef.current;
    if (isRemoteControlActive || !isSong || !isPlaying || !currentSong?.id)
      return;

    if (progress === 0 && !isNowPlayingSentRef.current) {
      subsonic.scrobble.send(currentSong.id, false);
      isNowPlayingSentRef.current = true;
    }

    if (progress === 0 && !isPlaying) {
      isNowPlayingSentRef.current = false;
    }
  }, [isSong, isPlaying, currentSong?.id, progress, audioRef]);

  useEffect(() => {
    isNowPlayingSentRef.current = false;
  }, []);

  const currentTime = convertSecondsToTime(
    isLocalSeeking ? localProgress : progress,
  );

  const songDuration = useMemo(
    () => convertSecondsToTime(currentDuration ?? 0),
    [currentDuration],
  );

  const isProgressLarge = useMemo(() => {
    return localProgress >= 3600 || progress >= 3600;
  }, [localProgress, progress]);

  const isDurationLarge = useMemo(() => {
    return currentDuration >= 3600;
  }, [currentDuration]);

  return (
    <div
      className={clsx(
        "flex w-full justify-center items-center gap-2",
        isEmpty && "opacity-50",
      )}
    >
      <small
        className={clsx(
          "text-xs text-muted-foreground text-right",
          isProgressLarge ? "min-w-14" : "min-w-10",
        )}
        data-testid="player-current-time"
      >
        {currentTime}
      </small>
      {!isEmpty ? (
        <ProgressSlider
          defaultValue={[0]}
          value={isLocalSeeking ? [localProgress] : [progress]}
          max={currentDuration ?? 0}
          step={1}
          className="cursor-pointer w-[32rem]"
          isBuffering={isBuffering}
          onValueChange={([value]) => handleSeeking(value)}
          onValueCommit={([value]) => handleSeeked(value)}
          // Sometimes onValueCommit doesn't work properly
          // so we also have to set the value on pointer/mouse up events
          // see https://github.com/radix-ui/primitives/issues/1760
          onPointerUp={handleSeekedFallback}
          onMouseUp={handleSeekedFallback}
          onTouchEnd={handleSeekedFallback}
          data-testid="player-progress-slider"
        />
      ) : (
        <ProgressSlider
          defaultValue={[0]}
          max={100}
          step={1}
          disabled={true}
          className="cursor-pointer w-[32rem] pointer-events-none"
        />
      )}
      <small
        className={clsx(
          "text-xs text-muted-foreground text-left",
          isDurationLarge ? "min-w-14" : "min-w-10",
        )}
        data-testid="player-duration-time"
      >
        {songDuration}
      </small>
    </div>
  );
}
