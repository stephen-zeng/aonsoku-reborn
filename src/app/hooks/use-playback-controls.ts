import {
  usePlayerActions,
  usePlayerIsPlaying,
  usePlayerLoop,
  usePlayerPrevAndNext,
  usePlayerShuffle,
} from "@/store/player.store";
import { LoopState } from "@/types/playerContext";

export function usePlaybackControls() {
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

  const cannotSkipNext = !hasNext && loopState !== LoopState.All;
  const cannotSkipPrev = !hasPrev;
  const isLoopOff = loopState === LoopState.Off;
  const isLoopAll = loopState === LoopState.All;
  const isLoopOne = loopState === LoopState.One;

  return {
    isPlaying,
    isShuffleActive,
    loopState,
    hasPrev,
    hasNext,
    cannotSkipNext,
    cannotSkipPrev,
    isLoopOff,
    isLoopAll,
    isLoopOne,
    isPlayingOneSong,
    toggleShuffle,
    playNextSong,
    playPrevSong,
    togglePlayPause,
    toggleLoop,
  };
}
