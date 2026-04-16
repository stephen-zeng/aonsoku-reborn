import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { memo } from "react";
import RepeatOne from "@/app/components/icons/repeat-one";
import { Button } from "@/app/components/ui/button";
import { useIsPortraitViewport } from "@/app/hooks/use-mobile";
import { usePlaybackControls } from "@/app/hooks/use-playback-controls";
import { LoopState } from "@/types/playerContext";

function FullscreenControls() {
  const {
    isPlaying,
    isShuffleActive,
    loopState,
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
  const isPortraitViewport = useIsPortraitViewport();

  return (
    <>
      {!isPortraitViewport && (
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
      )}
      <Button
        size="icon"
        variant="ghost"
        className={buttonsStyle.secondary}
        style={{ ...buttonsStyle.style }}
        onClick={() => playPrevSong()}
        disabled={cannotSkipPrev}
      >
        <SkipBack className={buttonsStyle.secondaryIconFilled} />
      </Button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        className={clsx(
          "w-14 h-14 rounded-full bg-secondary-foreground",
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
        disabled={cannotSkipNext}
      >
        <SkipForward className={buttonsStyle.secondaryIconFilled} />
      </Button>
      {!isPortraitViewport && (
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
          {isLoopOff && <Repeat className={buttonsStyle.secondaryIcon} />}
          {isLoopAll && <Repeat className={buttonsStyle.secondaryIcon} />}
          {isLoopOne && <RepeatOne className={buttonsStyle.secondaryIcon} />}
        </Button>
      )}
    </>
  );
}

export const MemoFullscreenControls = memo(FullscreenControls);

export const buttonsStyle = {
  secondary:
    "relative w-11 h-11 sm:w-12 sm:h-12 rounded-full text-secondary-foreground hover:text-secondary-foreground data-[state=active]:text-primary hover:bg-transparent hover:scale-110 transition-transform will-change-transform",
  secondaryIcon: "w-5 h-5 sm:w-6 sm:h-6",
  secondaryIconFilled:
    "w-5 h-5 sm:w-6 sm:h-6 text-secondary-foreground fill-secondary-foreground",
  activeDot: "player-button-active",
  style: {
    backfaceVisibility: "hidden" as const,
  },
};
