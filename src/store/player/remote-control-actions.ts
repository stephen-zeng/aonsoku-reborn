import type { Draft } from "immer";
import type {
  IPlayerActions,
  IPlayerContext,
  ISongList,
} from "@/types/playerContext";
import type { ISong } from "@/types/responses/song";
import {
  CurrentSongData,
  LanControlMessageType,
  PlayerStateData,
  QueueData,
  RemoteDeviceInfo,
} from "@/types/lanControl";
import { LoopState } from "@/types/playerContext";
import clamp from "lodash/clamp";
import { emptyContextQueue, resetPlaybackState } from "./queue-utils";

interface SharedDeps {
  set: (fn: (state: Draft<IPlayerContext>) => void) => void;
  get: () => IPlayerContext;
  isRemoteActive: () => boolean;
  remoteSend: (type: LanControlMessageType, data?: unknown) => boolean;
  mapRepeatMode: (
    repeatMode: PlayerStateData["repeatMode"] | undefined,
  ) => LoopState;
  remoteSongToISong: (song: CurrentSongData) => ISong;
  clearSonglistState: (state: Draft<ISongList>) => void;
}

export function createRemoteControlActions(shared: SharedDeps) {
  const { set, get, mapRepeatMode, remoteSongToISong, clearSonglistState } =
    shared;

  const setRemoteQueueState = (queue: QueueData | null) => {
    set((state) => {
      if (!queue) {
        clearSonglistState(state.songlist);
        state.playerState.hasPrev = false;
        state.playerState.hasNext = false;
        return;
      }

      const mappedSongs = queue.songs.map(remoteSongToISong);

      state.songlist.contextQueue = {
        ...emptyContextQueue(),
        songs: mappedSongs,
        currentIndex: queue.currentIndex ?? 0,
      };
      state.songlist.userQueue = { songs: [] };
      state.songlist.originalContextSongs = mappedSongs;
      state.songlist.isShuffleActive = false;
      state.songlist.isInUserQueue = false;
      state.songlist.playedUserQueueHistory = [];
      state.songlist.shuffleHistory = [];
      const lastIndex = mappedSongs.length - 1;
      const currentIndex = queue.currentIndex ?? 0;
      state.playerState.hasPrev = currentIndex > 0;
      state.playerState.hasNext = currentIndex < lastIndex;
      state.playerState.mediaType = "song";
    });
  };

  const setRemoteCurrentSong = (song: CurrentSongData | null) => {
    set((state) => {
      state.songlist.currentSong = song ? remoteSongToISong(song) : null;
    });
  };

  const setRemotePlayerStateInternal = (stateData: PlayerStateData | null) => {
    if (!stateData) {
      set((state) => {
        resetPlaybackState(state);
      });
      return;
    }

    set((state) => {
      state.playerState.isPlaying = stateData.isPlaying;
      state.playerProgress.progress = stateData.currentTime ?? 0;
      state.playerState.currentDuration = stateData.duration ?? 0;
      state.playerState.volume = clamp(Number(stateData.volume ?? 0), 0, 100);
      state.songlist.isShuffleActive = Boolean(stateData.isShuffle);
      state.playerState.loopState = mapRepeatMode(stateData.repeatMode);
      state.playerState.hasPrev = Boolean(stateData.hasPrevious);
      state.playerState.hasNext = Boolean(stateData.hasNext);
      state.playerState.mediaType = "song";
    });
  };

  return {
    enterRemoteControl: (device: RemoteDeviceInfo | null) => {
      const audioRef = get().playerState.audioPlayerRef;
      const radioRef = get().playerState.radioPlayerRef;
      for (const ref of [audioRef, radioRef]) {
        if (ref) {
          try {
            ref.pause();
          } catch (error) {
            if (error instanceof DOMException && error.name !== "AbortError") {
              console.error("[RemoteControl] Failed to pause audio", error);
            }
          }
        }
      }

      set((state) => {
        state.remoteControl.active = true;
        state.remoteControl.device = device ?? null;
        resetPlaybackState(state);
        clearSonglistState(state.songlist);
      });
    },

    exitRemoteControl: () => {
      set((state) => {
        state.remoteControl.active = false;
        state.remoteControl.device = null;
        state.remoteControl.sendCommand = null;
        resetPlaybackState(state);
        clearSonglistState(state.songlist);
      });
    },

    registerRemoteSender: (
      sender: (type: LanControlMessageType, data?: unknown) => void,
    ) => {
      set((state) => {
        state.remoteControl.sendCommand = sender;
      });
    },

    clearRemoteSender: () => {
      set((state) => {
        state.remoteControl.sendCommand = null;
      });
    },

    setRemotePlayerState: (stateData: PlayerStateData | null) => {
      if (!get().remoteControl.active) return;
      setRemotePlayerStateInternal(stateData ?? null);
    },

    setRemoteCurrentSongData: (song: CurrentSongData | null) => {
      if (!get().remoteControl.active) return;
      setRemoteCurrentSong(song ?? null);
    },

    setRemoteQueueData: (queue: QueueData | null) => {
      if (!get().remoteControl.active) return;
      setRemoteQueueState(queue ?? null);
    },

    setRemoteDevice: (device: RemoteDeviceInfo | null) => {
      if (!get().remoteControl.active) return;
      set((state) => {
        state.remoteControl.device = device ?? null;
      });
    },
  } satisfies Partial<IPlayerActions>;
}
