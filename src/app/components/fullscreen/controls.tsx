import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
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
import {
  usePlayerActions,
  usePlayerIsPlaying,
  usePlayerLoop,
  usePlayerPrevAndNext,
  usePlayerShuffle,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";

export function FullscreenControls() {
  const isPlaying = usePlayerIsPlaying();
  const isShuffleActive = usePlayerShuffle();
  const loopState = usePlayerLoop();
  const { hasPrev, hasNext } = usePlayerPrevAndNext();
  const {
    isPlayingOneSong,
    toggleShuffle,
    playNextSong,
    playPrevSong,
    togglePlayPause,
    toggleLoop,
  } = usePlayerActions();

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        data-state={isShuffleActive && "active"}
        className={clsx(
          buttonsStyle.secondary,
          isShuffleActive && buttonsStyle.activeDot,
        )}
        style={{ ...buttonsStyle.style }}
        onClick={() => toggleShuffle()}
        disabled={isPlayingOneSong() || !hasNext}
      >
        <Shuffle className={buttonsStyle.secondaryIcon} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className={buttonsStyle.secondary}
        style={{ ...buttonsStyle.style }}
        onClick={() => playPrevSong()}
        disabled={!hasPrev}
      >
        <SkipBack className={buttonsStyle.secondaryIconFilled} />
      </Button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        className={clsx(
          "w-14 h-14 rounded-full shadow-lg bg-secondary-foreground",
          "flex items-center justify-center cursor-pointer",
          "hover:scale-105 transition-transform will-change-transform",
        )}
        style={{ backfaceVisibility: "hidden" }}
        onClick={() => togglePlayPause()}
        aria-label={isPlaying ? "Pause" : "Play"}
        type="button"
      >
        <AnimatePresence mode="wait">
          {isPlaying ? (
            <motion.div
              key="pause"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Pause
                className="w-6 h-6 text-secondary fill-secondary"
                strokeWidth={1}
              />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Play className="w-6 h-6 text-secondary fill-secondary" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
      <Button
        size="icon"
        variant="ghost"
        className={buttonsStyle.secondary}
        style={{ ...buttonsStyle.style }}
        onClick={() => playNextSong()}
        disabled={!hasNext && loopState !== LoopState.All}
      >
        <SkipForward className={buttonsStyle.secondaryIconFilled} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        data-state={loopState !== LoopState.Off && "active"}
        className={clsx(
          buttonsStyle.secondary,
          loopState !== LoopState.Off && buttonsStyle.activeDot,
        )}
        onClick={() => toggleLoop()}
        style={{ ...buttonsStyle.style }}
      >
        {loopState === LoopState.Off && (
          <Repeat className={buttonsStyle.secondaryIcon} />
        )}
        {loopState === LoopState.All && (
          <Repeat className={buttonsStyle.secondaryIcon} />
        )}
        {loopState === LoopState.One && (
          <RepeatOne className={buttonsStyle.secondaryIcon} />
        )}
      </Button>
    </>
  );
}

export const buttonsStyle = {
  secondary:
    "relative w-11 h-11 sm:w-12 sm:h-12 rounded-full text-secondary-foreground hover:text-secondary-foreground data-[state=active]:text-primary hover:bg-transparent hover:scale-110 transition-transform will-change-transform",
  secondaryIcon: "w-5 h-5 sm:w-6 sm:h-6 drop-shadow-lg",
  secondaryIconFilled:
    "w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground fill-secondary-foreground drop-shadow-lg",
  activeDot: "player-button-active",
  style: {
    backfaceVisibility: "hidden" as const,
  },
};
