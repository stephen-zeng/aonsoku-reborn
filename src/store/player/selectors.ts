import { shallow } from "zustand/shallow";
import { getEffectiveIndex, getEffectiveQueue } from "./queue-utils";
import { usePlayerStore } from "./store";

export const usePlayerActions = () => usePlayerStore((state) => state.actions);

export const usePlayerSonglist = () =>
  usePlayerStore(
    (state) => ({
      currentList: getEffectiveQueue(state.songlist),
      currentSong: state.songlist.currentSong,
      currentSongIndex: getEffectiveIndex(state.songlist),
      radioList: state.songlist.radioList,
    }),
    shallow,
  );

export const usePlayerCurrentSong = () =>
  usePlayerStore((state) => state.songlist.currentSong);

export const usePlayerCurrentSongIndex = () =>
  usePlayerStore((state) => getEffectiveIndex(state.songlist));

export const usePlayerProgress = () =>
  usePlayerStore((state) => state.playerProgress.progress);

export const usePlayerBufferedProgress = () =>
  usePlayerStore((state) => state.playerProgress.bufferedProgress);

export const usePlayerIsScrubbing = () =>
  usePlayerStore((state) => state.playerProgress.isScrubbing);

export const usePlayerVolume = () =>
  usePlayerStore(
    (state) => ({
      volume: state.playerState.volume,
      setVolume: state.actions.setVolume,
      handleVolumeWheel: state.actions.handleVolumeWheel,
    }),
    shallow,
  );

export const useVolumeSettings = () =>
  usePlayerStore((state) => state.settings.volume);

export const useReplayGainState = () =>
  usePlayerStore(
    (state) => ({
      replayGainEnabled: state.settings.replayGain.values.enabled,
      replayGainType: state.settings.replayGain.values.type,
      replayGainPreAmp: state.settings.replayGain.values.preAmp,
      replayGainError: state.settings.replayGain.values.error,
      replayGainDefaultGain: state.settings.replayGain.values.defaultGain,
    }),
    shallow,
  );

export const useReplayGainActions = () =>
  usePlayerStore((state) => state.settings.replayGain.actions);

export const useFullscreenPlayerSettings = () =>
  usePlayerStore((state) => state.settings.fullscreen);

export const useCoverArtSettings = () =>
  usePlayerStore((state) => state.settings.coverArt);

export const usePrivacySettings = () =>
  usePlayerStore((state) => state.settings.privacy);

export const useLyricsSettings = () =>
  usePlayerStore((state) => state.settings.lyrics);

export const useHapticSettings = () =>
  usePlayerStore((state) => state.settings.hapticFeedback);

export const usePipSettings = () =>
  usePlayerStore((state) => state.settings.pip);

export const usePlayerSettings = () =>
  usePlayerStore((state) => state.settings);

export const usePlayerMediaType = () => {
  const mediaType = usePlayerStore((state) => state.playerState.mediaType);
  const isSong = mediaType === "song";
  const isRadio = mediaType === "radio";

  return {
    isSong,
    isRadio,
  };
};

export const usePlayerIsPlaying = () =>
  usePlayerStore((state) => state.playerState.isPlaying);

export const usePlayerIsTransitioning = () =>
  usePlayerStore((state) => state.playerState.isTransitioning);

export const usePlayerDuration = () =>
  usePlayerStore((state) => state.playerState.currentDuration);

export const usePlayerSongStarred = () =>
  usePlayerStore((state) => state.playerState.isSongStarred);

export const usePlayerShuffle = () =>
  usePlayerStore((state) => state.songlist.isShuffleActive);

export const usePlayerLoop = () =>
  usePlayerStore((state) => state.playerState.loopState);

export const usePlayerPrevAndNext = () =>
  usePlayerStore(
    (state) => ({
      hasPrev: state.playerState.hasPrev,
      hasNext: state.playerState.hasNext,
    }),
    shallow,
  );

export const usePlayerRef = () =>
  usePlayerStore((state) => state.playerState.audioPlayerRef);

export const useRadioPlayerRef = () =>
  usePlayerStore((state) => state.playerState.radioPlayerRef);

export const getVolume = () => usePlayerStore.getState().playerState.volume;

export const useMainDrawerState = () =>
  usePlayerStore(
    (state) => ({
      mainDrawerState: state.playerState.mainDrawerState,
      setMainDrawerState: state.actions.setMainDrawerState,
      toggleQueueAndLyrics: state.actions.toggleQueueAndLyrics,
      closeDrawer: state.actions.closeDrawer,
    }),
    shallow,
  );

export const useQueueState = () =>
  usePlayerStore(
    (state) => ({
      queueState: state.playerState.queueState,
      setQueueState: state.actions.setQueueState,
      toggleQueueAction: state.actions.toggleQueueAction,
    }),
    shallow,
  );

export const useLyricsState = () =>
  usePlayerStore(
    (state) => ({
      lyricsState: state.playerState.lyricsState,
      setLyricsState: state.actions.setLyricsState,
      toggleLyricsAction: state.actions.toggleLyricsAction,
    }),
    shallow,
  );

export const useFullscreenPlayerState = () =>
  usePlayerStore(
    (state) => ({
      fullscreenPlayerOpen: state.playerState.fullscreenPlayerOpen,
      fullscreenPlayerTab: state.playerState.fullscreenPlayerTab,
      desktopFullscreenPanelView: state.playerState.desktopFullscreenPanelView,
      openFullscreenPlayer: state.actions.openFullscreenPlayer,
      closeFullscreenPlayer: state.actions.closeFullscreenPlayer,
      setFullscreenPlayerTab: state.actions.setFullscreenPlayerTab,
      setDesktopFullscreenPanelView:
        state.actions.setDesktopFullscreenPanelView,
    }),
    shallow,
  );

export const useSongColor = () =>
  usePlayerStore(
    (state) => ({
      currentSongColor: state.settings.colors.currentSongColor,
      setCurrentSongColor: state.actions.setCurrentSongColor,
      currentSongColorIntensity:
        state.settings.colors.currentSongColorIntensity,
      setCurrentSongIntensity: state.actions.setCurrentSongIntensity,
    }),
    shallow,
  );

export const usePlayerCurrentList = () =>
  usePlayerStore(
    (state) => getEffectiveQueue(state.songlist),
    (a, b) => a.length === b.length && a.every((s, i) => s === b[i]),
  );

export const useHasQueueSongs = () =>
  usePlayerStore(
    (s) =>
      s.songlist.contextQueue.songs.length > 0 ||
      s.songlist.userQueue.songs.length > 0,
  );

export const useHasRemainingUserQueue = () =>
  usePlayerStore((state) => state.songlist.userQueue.songs.length > 0);

export const useQueueSource = () =>
  usePlayerStore((state) => state.songlist.contextQueue.sourceName);

export const useUserQueue = () =>
  usePlayerStore(
    (state) => ({
      userQueueSongs: state.songlist.userQueue.songs,
      clearUserQueue: state.actions.clearUserQueue,
    }),
    shallow,
  );

export const useContextQueue = () =>
  usePlayerStore(
    (state) => ({
      contextSongs: state.songlist.contextQueue.songs,
      contextIndex: state.songlist.contextQueue.currentIndex,
    }),
    shallow,
  );

export const useRemoteControlState = () =>
  usePlayerStore((state) => state.remoteControl);

export const useIsRemoteControlActive = () =>
  usePlayerStore((state) => state.remoteControl.active);

export const usePlayerIsBuffering = () =>
  usePlayerStore((state) => state.playerState.isBuffering);

export const useLyricsAlignment = () =>
  usePlayerStore((state) => state.playerState.areLyricsAligned);

export const usePipWindowOpen = () =>
  usePlayerStore((state) => state.playerState.pipWindowOpen);

export function useIsCurrentPlaying(songId: string): boolean {
  return usePlayerStore((state) => {
    if (!state.playerState.isPlaying) return false;
    const mediaType = state.playerState.mediaType;
    if (mediaType === "song") {
      return state.actions.checkActiveSong(songId);
    }
    if (mediaType === "radio") {
      const idx = getEffectiveIndex(state.songlist);
      return state.songlist.radioList[idx]?.id === songId;
    }
    return false;
  });
}
