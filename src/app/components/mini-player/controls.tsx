import { clsx } from "clsx";
import {
  Heart,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import RepeatOne from "@/app/components/icons/repeat-one";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { LoopState } from "@/types/playerContext";
import { useMiniPlayerContext } from "./context";

export function MiniPlayerControls() {
  const { state, actions } = useMiniPlayerContext();

  if (!state) return null;

  const isLoopOff = state.loopState === LoopState.Off;
  const isLoopAll = state.loopState === LoopState.All;
  const isLoopOne = state.loopState === LoopState.One;

  return (
    <div className="flex items-center">
      <Button
        size="icon"
        variant="ghost"
        data-state={state.shuffleActive && "active"}
        className={clsx(
          buttonsStyle.secondary,
          buttonsStyle.removeRing,
          state.shuffleActive && buttonsStyle.activeDot,
          "mini-player:hidden",
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => actions.toggleShuffle()}
        disabled={state.isPlaying && !state.hasNext}
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
        onClick={() => actions.playPrevSong()}
        disabled={!state.hasPrev}
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
        onClick={() => actions.togglePlayPause()}
      >
        {state.isPlaying ? (
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
        onClick={() => actions.playNextSong()}
        disabled={!state.hasNext && state.loopState !== LoopState.All}
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
        onClick={() => actions.toggleLoop()}
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
  const { state, actions } = useMiniPlayerContext();

  if (!state) return null;

  return (
    <Button
      size="icon"
      variant="ghost"
      className={clsx(
        buttonsStyle.secondary,
        buttonsStyle.removeRing,
        "mini-player:hidden",
      )}
      onClick={() => actions.starCurrentSong()}
      style={{ ...buttonsStyle.style }}
      unfocusable
    >
      <Heart
        className={clsx(state.isSongStarred && "text-red-500 fill-red-500")}
        size={18}
      />
    </Button>
  );
}

const buttonsStyle = {
  main: "w-9 h-9 p-0 rounded-full bg-secondary-foreground",
  mainIcon: "text-secondary fill-secondary",
  secondary:
    "relative w-9 h-9 p-0 rounded-full text-secondary-foreground hover-supported:text-secondary-foreground data-[state=active]:text-primary hover-supported:bg-transparent",
  secondaryIconFilled: "text-secondary-foreground fill-secondary-foreground",
  activeDot: "mini-player-button-active",
  style: {
    backfaceVisibility: "hidden" as const,
  },
  removeRing:
    "focus-visible:ring-0 focus-visible:ring-transparent ring-0 ring-offset-transparent",
};
