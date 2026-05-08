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
import { useFullscreenContrast } from "@/app/hooks/use-fullscreen-contrast";
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
  const { isBackdropDark, playButtonBg, playButtonIcon } =
    useFullscreenContrast();

  const secondaryBtnClass = clsx(
    "relative w-11 h-11 md:w-12 md:h-12 rounded-full text-foreground",
    isBackdropDark
      ? "data-[state=active]:text-white"
      : "data-[state=active]:text-primary",
    "hover:bg-transparent hover:scale-110 transition-transform will-change-transform",
  );

  return (
    <>
      {!isPortraitViewport && (
        <Button
          size="icon"
          variant="ghost"
          data-state={isShuffleActive ? "active" : undefined}
          className={clsx(secondaryBtnClass, isShuffleActive && "fullscreen-button-active")}
          style={{ backfaceVisibility: "hidden" }}
          onClick={() => toggleShuffle()}
          disabled={isPlayingOneSong() || !hasNext}
          unfocusable
        >
          <Shuffle className="w-5 h-5 md:w-6 md:h-6" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className={secondaryBtnClass}
        style={{ backfaceVisibility: "hidden" }}
        onClick={() => playPrevSong()}
        disabled={cannotSkipPrev}
        unfocusable
      >
        <SkipBack className="w-5 h-5 md:w-6 md:h-6 text-secondary-foreground fill-secondary-foreground" />
      </Button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        className={clsx(
          "w-14 h-14 rounded-full flex items-center justify-center cursor-pointer",
          "",
          playButtonBg,
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
              <Pause className={clsx("w-6 h-6", playButtonIcon)} strokeWidth={1} />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Play className={clsx("w-6 h-6", playButtonIcon)} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
      <Button
        size="icon"
        variant="ghost"
        className={secondaryBtnClass}
        style={{ backfaceVisibility: "hidden" }}
        onClick={() => playNextSong()}
        disabled={cannotSkipNext}
        unfocusable
      >
        <SkipForward className="w-5 h-5 md:w-6 md:h-6 text-secondary-foreground fill-secondary-foreground" />
      </Button>
      {!isPortraitViewport && (
        <Button
          size="icon"
          variant="ghost"
          data-state={loopState !== LoopState.Off ? "active" : undefined}
          className={clsx(
            secondaryBtnClass,
            loopState !== LoopState.Off && "fullscreen-button-active",
          )}
          onClick={() => toggleLoop()}
          style={{ backfaceVisibility: "hidden" }}
          unfocusable
        >
          {isLoopOff && <Repeat className="w-5 h-5 md:w-6 md:h-6" />}
          {isLoopAll && <Repeat className="w-5 h-5 md:w-6 md:h-6" />}
          {isLoopOne && <RepeatOne className="w-5 h-5 md:w-6 md:h-6" />}
        </Button>
      )}
    </>
  );
}

export const MemoFullscreenControls = memo(FullscreenControls);