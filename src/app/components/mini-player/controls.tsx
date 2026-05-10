import { clsx } from "clsx";
import { Heart } from "lucide-react";
import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import RepeatOne from "@/app/components/icons/repeat-one";
import { Button } from "@/app/components/ui/button";
import { usePlaybackControls } from "@/app/hooks/use-playback-controls";
import { usePlayerActions, usePlayerSongStarred } from "@/store/player.store";
import { cn } from "@/lib/utils";

export function MiniPlayerControls() {
  const {
    isPlaying,
    isShuffleActive,
    cannotSkipPrev,
    cannotSkipNext,
    isLoopOff,
    isLoopAll,
    isLoopOne,
    isPlayingOneSong,
    toggleShuffle,
    playPrevSong,
    togglePlayPause,
    playNextSong,
    toggleLoop,
    hasNext,
  } = usePlaybackControls();

  return (
    <div className="flex items-center">
      <Button
        size="icon"
        variant="ghost"
        data-state={isShuffleActive && "active"}
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          isShuffleActive && buttonsStyle.activeDot,
          "mini-player:hidden",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => toggleShuffle()}
        disabled={isPlayingOneSong() || !hasNext}
        unfocusable
      >
        <Shuffle size={18} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          "mini-player:hidden",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => playPrevSong()}
        disabled={cannotSkipPrev}
        unfocusable
      >
        <SkipBack className={buttonsStyle.secondaryIconFilled} width={20} />
      </Button>
      <Button
        size="icon"
        variant="link"
        className={cn(
          buttonsStyle.main,
          buttonsStyle.removeRing,
          "mini-player:w-8 mini-player:h-8",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => togglePlayPause()}
      >
        {isPlaying ? (
          <Pause
            className={buttonsStyle.mainIcon}
            size={20}
            strokeWidth={0.75}
            strokeLinecap="square"
            strokeLinejoin="round"
          />
        ) : (
          <Play className={buttonsStyle.mainIcon} size={18} strokeWidth={1} />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          "mini-player:w-8 mini-player:h-8",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => playNextSong()}
        disabled={cannotSkipNext}
        unfocusable
      >
        <SkipForward className={buttonsStyle.secondaryIconFilled} size={20} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          !isLoopOff && buttonsStyle.activeDot,
          "mini-player:hidden",
        )}
        onClick={() => toggleLoop()}
        style={{ ...buttonsStyle.style }}
        unfocusable
      >
        {isLoopOff && <Repeat size={18} />}
        {isLoopAll && <Repeat size={18} />}
        {isLoopOne && <RepeatOne size={18} />}
      </Button>
    </div>
  );
}

export function MiniPlayerLikeButton() {
  const isSongStarred = usePlayerSongStarred();
  const { starCurrentSong } = usePlayerActions();

  return (
    <Button
      size="icon"
      variant="ghost"
      className={clsx(
        buttonsStyle.secondary,
        buttonsStyle.removeRing,
        "mini-player:hidden",
      )}
      onClick={starCurrentSong}
      style={{ ...buttonsStyle.style }}
      unfocusable
    >
      <Heart
        className={clsx(isSongStarred && "text-red-500 fill-red-500")}
        size={18}
      />
    </Button>
  );
}

const buttonsStyle = {
  main: "w-9 h-9 p-0 rounded-full bg-secondary-foreground",
  mainIcon: "text-secondary fill-secondary",
  secondary:
    "relative w-9 h-9 p-0 rounded-full text-secondary-foreground hover:text-secondary-foreground data-[state=active]:text-primary hover:bg-transparent",
  secondaryIconFilled: "text-secondary-foreground fill-secondary-foreground",
  activeDot: "mini-player-button-active",
  style: {
    backfaceVisibility: "hidden" as const,
  },
  removeRing:
    "focus-visible:ring-0 focus-visible:ring-transparent ring-0 ring-offset-transparent",
};
