
import merge from "lodash/merge";
import omit from "lodash/omit";
import debounce from "lodash/debounce";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import {
  CurrentSongData,
  LanControlMessageType,
  PlayerStateData,
} from "@/types/lanControl";
import {
  IPlayerContext,
  ISongList,
  LoopState,
} from "@/types/playerContext";
import { ISong } from "@/types/responses/song";
import { isDesktop } from "@/utils/desktop";
import { discordRpc } from "@/utils/discordRpc";
import { logger } from "@/utils/logger";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { createQueueActions } from "./queue-actions";
import { createPlaybackActions } from "./playback-actions";
import { createUiActions } from "./ui-actions";
import { createRemoteControlActions } from "./remote-control-actions";
import { createStarActions } from "./star-actions";
import { createSettingsActions } from "./settings-actions";
import {
  initialPlayerState,
  initialPlayerProgress,
  initialRemoteControl,
  createInitialSettings,
  initialSonglist,
} from "./initial-state";
import {
  clearSonglistState,
  getEffectiveIndex,
  getEffectiveQueue,
  hasAnySongs,
} from "./queue-utils";

const IDB_SONGLIST_KEY = "player_songlist";

export const usePlayerStore = createWithEqualityFn<IPlayerContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set, get) => {
          const isRemoteActive = () => get().remoteControl.active;

          const remoteSend = (
            type: LanControlMessageType,
            data?: unknown,
          ) => {
            const { active, sendCommand } = get().remoteControl;
            if (!active || !sendCommand) return false;
            sendCommand(type, data);
            return true;
          };

          const mapRepeatMode = (
            repeatMode: PlayerStateData["repeatMode"] | undefined,
          ) => {
            if (repeatMode === "one") return LoopState.One;
            if (repeatMode === "all") return LoopState.All;
            return LoopState.Off;
          };

          const remoteSongToISong = (song: CurrentSongData): ISong => ({
            id: song.id,
            parent: "",
            isDir: false,
            title: song.title ?? "",
            album: song.album ?? "",
            artist: song.artist ?? "",
            track: 0,
            year: 0,
            genre: undefined,
            coverArt: song.coverArt ?? "",
            size: 0,
            contentType: "",
            suffix: "",
            duration: song.duration ?? 0,
            bitRate: 0,
            path: "",
            playCount: 0,
            discNumber: 0,
            created: "remote",
            albumId: song.albumId ?? "",
            artistId: undefined,
            type: "remote",
            isVideo: false,
            played: undefined,
            bpm: 0,
            starred: undefined,
            comment: "",
            sortName: song.title ?? "",
            mediaType: "song",
            musicBrainzId: "",
            genres: [],
            replayGain: {
              trackGain: 0,
              trackPeak: 1,
              albumGain: 0,
              albumPeak: 1,
            },
            channelCount: undefined,
            samplingRate: undefined,
            bitDepth: undefined,
            moods: undefined,
            artists: undefined,
            displayArtist: song.artist,
            albumArtists: undefined,
            displayAlbumArtist: song.album,
            contributors: undefined,
            displayComposer: undefined,
            explicitStatus: undefined,
          });

          const shared = {
            set,
            get,
            isRemoteActive,
            remoteSend,
            mapRepeatMode,
            remoteSongToISong,
            clearSonglistState,
          };

          const queueActions = createQueueActions(shared);
          const playbackActions = createPlaybackActions(shared);
          const uiActions = createUiActions(shared);
          const remoteControlActions = createRemoteControlActions(shared);
          const starActions = createStarActions(shared);
          const settingsActions = createSettingsActions(shared);

          return {
            songlist: initialSonglist,
            playerState: initialPlayerState,
            playerProgress: initialPlayerProgress,
            settings: createInitialSettings(set),
            remoteControl: initialRemoteControl,
            actions: {
              ...queueActions,
              ...playbackActions,
              ...uiActions,
              ...remoteControlActions,
              ...starActions,
              ...settingsActions,
            },
          };
        }),
        { name: "player_store" },
      ),
      {
        name: "player_store",
        version: 3,
        // biome-ignore lint/suspicious/noExplicitAny: zustand persist migrate API
        migrate: (persistedState: any, version) => {
          if (version === 1) {
            // biome-ignore lint/suspicious/noExplicitAny: legacy state shape
            const old = persistedState as any;
            if (old.songlist) {
              const oldSl = old.songlist;
              old.songlist = {
                contextQueue: {
                  songs: oldSl.originalList || oldSl.currentList || [],
                  currentIndex: oldSl.currentSongIndex || 0,
                  sourceId: null,
                  sourceName: oldSl.queueSource || null,
                },
                userQueue: { songs: [] },
                originalContextSongs:
                  oldSl.originalList || oldSl.currentList || [],
                currentSong: oldSl.currentSong || null,
                radioList: oldSl.radioList || [],
                isShuffleActive: oldSl.isShuffleActive || false,
                isInUserQueue: false,
                playedUserQueueHistory: [],
                shuffleHistory: [],
              };
              delete old.songlist.shuffledList;
              delete old.songlist.currentList;
              delete old.songlist.originalList;
              delete old.songlist.originalSongIndex;
              delete old.songlist.currentSongIndex;
              delete old.songlist.queueSource;
            }
            if (old.playerState) {
              delete old.playerState.isShuffleActive;
            }
          }
          if (version <= 2) {
            // biome-ignore lint/suspicious/noExplicitAny: migrate userQueuePosition to isInUserQueue
            const old = persistedState as any;
            if (old.songlist) {
              if (old.songlist.userQueuePosition !== undefined) {
                old.songlist.isInUserQueue = old.songlist.userQueuePosition > 0;
                old.songlist.playedUserQueueHistory = [];
                delete old.songlist.userQueuePosition;
              }
            }
          }
          return persistedState;
        },
        merge: (persistedState, currentState) => {
          return merge(currentState, persistedState);
        },
        partialize: (state) => {
          const appStore = omit(state, [
            "songlist",
            "actions",
            "playerState.isPlaying",
            "playerState.isBuffering",
            "playerState.audioPlayerRef",
            "playerState.mainDrawerState",
            "playerState.queueState",
            "playerState.lyricsState",
            "playerState.fullscreenPlayerOpen",
            "playerState.fullscreenPlayerTab",
            "playerState.desktopFullscreenPanelView",
            "playerState.hasPrev",
            "playerState.hasNext",
            "remoteControl",
          ]);

          return appStore;
        },
        onRehydrateStorage: () => {
          return (_state, error) => {
            if (error) {
              logger.error("Player store rehydration failed", error);
              songlistHydrated.value = true;
              return;
            }
            idbGet<ISongList>(IDB_SONGLIST_KEY)
              .then((value) => {
                if (value) {
                  const current = usePlayerStore.getState().songlist;
                  if (
                    !value.contextQueue ||
                    value.contextQueue.songs.length === 0
                  ) {
                    const migrated = migrateLegacySonglist(value);
                    if (migrated) {
                      usePlayerStore.setState({ songlist: migrated });
                    }
                    return;
                  }
                  if (
                    current.contextQueue.songs.length === 0 &&
                    current.userQueue.songs.length === 0
                  ) {
                    const migrated = migrateSonglistFromIdb(value);
                    usePlayerStore.setState({
                      songlist: migrated,
                    });
                  }
                }
              })
              .catch((error: unknown) => {
                logger.error("Failed to load songlist from IDB", error);
              })
              .finally(() => {
                songlistHydrated.value = true;
              });
          };
        },
      },
    ),
  ),
  shallow,
);

// biome-ignore lint/suspicious/noExplicitAny: legacy state shape migration
function migrateLegacySonglist(value: any): ISongList | null {
  if (!value) return null;
  if (value.contextQueue && value.contextQueue.songs) return null;

  const songs = value.originalList || value.currentList || [];
  if (songs.length === 0) return null;

  return {
    contextQueue: {
      songs,
      currentIndex: value.currentSongIndex || 0,
      sourceId: null,
      sourceName: value.queueSource || null,
    },
    userQueue: { songs: [] },
    originalContextSongs: [...songs],
    currentSong: value.currentSong || null,
    radioList: value.radioList || [],
    isShuffleActive: false,
    isInUserQueue: false,
    playedUserQueueHistory: [],
    shuffleHistory: [],
  };
}

// biome-ignore lint/suspicious/noExplicitAny: IDB data may come from older schema versions
function migrateSonglistFromIdb(value: any): ISongList {
  const isInUserQueue = value.isInUserQueue ?? (value.userQueuePosition != null ? value.userQueuePosition > 0 : false);
  const userQueue = value.userQueue && typeof value.userQueue === "object" && Array.isArray(value.userQueue.songs)
    ? { songs: value.userQueue.songs }
    : { songs: [] };

  // When migrating from userQueuePosition model, the entire userQueue songs array
  // represented queued songs. We can't reconstruct which ones were already played,
  // so we default to isInUserQueue=false and treat all songs as pending.
  // Songs already past the old position pointer are simply queued.
  if (value.userQueuePosition != null && value.userQueuePosition > 0 && Array.isArray(userQueue.songs) && userQueue.songs.length > 0) {
    // The old model had all songs in the array with a position pointer.
    // We can't reconstruct which songs were consumed, so default to not in user queue.
  }

  const result: ISongList = {
    ...value,
    contextQueue: value.contextQueue ?? { songs: [], currentIndex: 0, sourceId: null, sourceName: null },
    userQueue,
    originalContextSongs: value.originalContextSongs ?? [],
    currentSong: value.currentSong ?? null,
    radioList: value.radioList ?? [],
    isShuffleActive: value.isShuffleActive ?? false,
    isInUserQueue,
    playedUserQueueHistory: value.playedUserQueueHistory ?? [],
    shuffleHistory: value.shuffleHistory ?? [],
  };

  delete result.userQueuePosition;

  return result;
}

const songlistHydrated = { value: false };

usePlayerStore.subscribe(
  (state) => [state.songlist],
  ([songlist]) => {
    if (!songlistHydrated.value) return;
    debouncedIdbSonglistWrite(songlist);
  },
  {
    equalityFn: shallow,
  },
);

const debouncedIdbSonglistWrite = debounce((songlist: ISongList) => {
  idbSet(IDB_SONGLIST_KEY, songlist);
}, 300);

function flushIdbSonglistWrite() {
  debouncedIdbSonglistWrite.cancel();
  const songlist = usePlayerStore.getState().songlist;
  idbSet(IDB_SONGLIST_KEY, songlist);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden && songlistHydrated.value) {
    flushIdbSonglistWrite();
  }
});

usePlayerStore.subscribe(
  (state) => [
    state.songlist.contextQueue.songs,
    state.songlist.contextQueue.currentIndex,
    state.songlist.userQueue.songs,
    state.songlist.isInUserQueue,
    state.songlist.playedUserQueueHistory,
  ],
  () => {
    const playerStore = usePlayerStore.getState();
    const { mediaType } = playerStore.playerState;
    if (mediaType === "radio") return;

    playerStore.actions.checkIsSongStarred();
    playerStore.actions.setCurrentSong();

    const { progress } = playerStore.playerProgress;

    if (!hasAnySongs(playerStore.songlist) && progress > 0) {
      playerStore.actions.resetProgress();
    }
  },
  {
    equalityFn: shallow,
  },
);

usePlayerStore.subscribe(
  ({ songlist }) => [
    songlist.contextQueue.songs,
    songlist.userQueue.songs,
    songlist.contextQueue.currentIndex,
    songlist.isInUserQueue,
    songlist.playedUserQueueHistory,
    songlist.radioList,
  ],
  () => {
    usePlayerStore.getState().actions.updateQueueChecks();
  },
  {
    equalityFn: shallow,
  },
);

usePlayerStore.subscribe(
  (state) => [
    state.songlist.currentSong,
    state.playerState.isPlaying,
    state.playerState.currentDuration,
  ],
  () => {
    discordRpc.sendCurrentSong();
  },
  {
    equalityFn: shallow,
  },
);

function desktopStateListener() {
  if (!isDesktop()) return;

  const {
    togglePlayPause,
    playPrevSong,
    playNextSong,
    toggleShuffle,
    toggleLoop,
  } = usePlayerStore.getState().actions;

  window.api.playerStateListener((action) => {
    if (action === "togglePlayPause") togglePlayPause();
    if (action === "skipBackwards") playPrevSong();
    if (action === "skipForward") playNextSong();
    if (action === "toggleShuffle") toggleShuffle();
    if (action === "toggleRepeat") toggleLoop();
  });
}

desktopStateListener();

function updateDesktopState() {
  if (!isDesktop()) return;

  const { isPlaying, hasPrev, hasNext } =
    usePlayerStore.getState().playerState;
  const { radioList, contextQueue, userQueue } = usePlayerStore.getState().songlist;

  const hasSongs = contextQueue.songs.length >= 1 || userQueue.songs.length >= 1;
  const hasRadios = radioList.length >= 1;

  window.api.updatePlayerState({
    isPlaying,
    hasPrevious: hasPrev,
    hasNext,
    hasSonglist: hasSongs || hasRadios,
  });
}

updateDesktopState();

usePlayerStore.subscribe(
  (state) => [
    state.playerState.isPlaying,
    state.playerState.hasPrev,
    state.playerState.hasNext,
    state.songlist.contextQueue.songs,
    state.songlist.userQueue.songs,
  ],
  () => {
    updateDesktopState();
  },
  {
    equalityFn: shallow,
  },
);

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
      desktopFullscreenPanelView:
        state.playerState.desktopFullscreenPanelView,
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
      useSongColorOnQueue: state.settings.colors.queue.useSongColor,
      setUseSongColorOnQueue: state.actions.setUseSongColorOnQueue,
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
    (s) => s.songlist.contextQueue.songs.length > 0 || s.songlist.userQueue.songs.length > 0,
  );

export const useHasRemainingUserQueue = () =>
  usePlayerStore(
    (state) =>
      state.songlist.userQueue.songs.length > 0,
  );

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