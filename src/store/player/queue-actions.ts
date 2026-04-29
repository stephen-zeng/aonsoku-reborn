import type { Draft } from "immer";
import type {
  IPlayerActions,
  IPlayerContext,
  ISongList,
  QueueSourceId,
  QueueTier,
} from "@/types/playerContext";
import { LoopState } from "@/types/playerContext";
import type { ISong } from "@/types/responses/song";
import type { Radio } from "@/types/responses/radios";
import { LanControlMessageType } from "@/types/lanControl";
import { areSongListsEqual } from "@/utils/compareSongLists";
import {
  MAX_SHUFFLE_HISTORY,
  shuffleWithGapAvoidance,
} from "@/utils/songListFunctions";
import {
  applyShuffleOff,
  applyShuffleOn,
  emptyContextQueue,
  findSongTier,
  getCurrentSong,
  hasNextEffectiveSong,
  hasPrevEffectiveSong,
  isPlayingOneSong,
  normalizeSourceId,
  reshuffleContextForWrap,
  sendAddToQueueRemote,
  setLastOnUserQueue,
  setNextOnUserQueue,
  trimQueueToWindow,
} from "./queue-utils";

interface SharedDeps {
  set: (fn: (state: Draft<IPlayerContext>) => void) => void;
  get: () => IPlayerContext;
  isRemoteActive: () => boolean;
  remoteSend: (type: LanControlMessageType, data?: unknown) => boolean;
  clearSonglistState: (state: Draft<ISongList>) => void;
}

const PREV_SEEK_THRESHOLD = 3;
const NEXT_SONG_DEBOUNCE_MS = 100;
const PREV_SONG_DEBOUNCE_MS = 100;

let lastNextSongTime = 0;
let lastPrevSongTime = 0;

function resetUserQueue(state: Draft<ISongList>) {
  state.userQueue = { songs: [] };
  state.isInUserQueue = false;
  state.playedUserQueueHistory = [];
}

function sendSongListRemote(
  remoteSend: (type: LanControlMessageType, data?: unknown) => boolean,
  songlist: ISong[],
  index: number,
  shuffle: boolean,
  sourceId?:
    | QueueSourceId
    | { albumId: string }
    | { playlistId: string }
    | null,
  sourceName?: string,
) {
  if (songlist.length === 0) return;
  const normalized = normalizeSourceId(sourceId);
  if (normalized) {
    if (normalized.type === "album") {
      const messageType = shuffle
        ? LanControlMessageType.PLAY_ALBUM_SHUFFLE
        : LanControlMessageType.PLAY_ALBUM;
      remoteSend(messageType, {
        albumId: normalized.id,
        songIndex: index,
      });
    } else if (normalized.type === "playlist") {
      const messageType = shuffle
        ? LanControlMessageType.PLAY_PLAYLIST_SHUFFLE
        : LanControlMessageType.PLAY_PLAYLIST;
      remoteSend(messageType, {
        playlistId: normalized.id,
        songIndex: index,
      });
    } else {
      remoteSend(LanControlMessageType.CLEAR_QUEUE);
      remoteSend(LanControlMessageType.ADD_TO_QUEUE, {
        songIds: songlist.map((song) => song.id),
      });
      const targetSong = songlist[index];
      if (targetSong) {
        remoteSend(LanControlMessageType.PLAY_SONG, {
          songId: targetSong.id,
        });
      }
      if (shuffle) {
        remoteSend(LanControlMessageType.SET_SHUFFLE, {
          enabled: true,
        });
      }
    }
  } else {
    remoteSend(LanControlMessageType.CLEAR_QUEUE);
    remoteSend(LanControlMessageType.ADD_TO_QUEUE, {
      songIds: songlist.map((song) => song.id),
    });
    const targetSong = songlist[index];
    if (targetSong) {
      remoteSend(LanControlMessageType.PLAY_SONG, {
        songId: targetSong.id,
      });
    }
    if (shuffle) {
      remoteSend(LanControlMessageType.SET_SHUFFLE, {
        enabled: true,
      });
    }
  }
}

export function createQueueActions(shared: SharedDeps) {
  const { set, get, isRemoteActive, remoteSend, clearSonglistState } = shared;

  return {
    setSongList: (
      songlist: ISong[],
      index: number,
      shuffle = false,
      sourceId?: QueueSourceId | { albumId: string } | { playlistId: string },
      sourceName?: string,
    ) => {
      if (!songlist || songlist.length === 0) return;
      index = Math.max(0, Math.min(index, songlist.length - 1));

      if (isRemoteActive()) {
        sendSongListRemote(
          remoteSend,
          songlist,
          index,
          shuffle,
          sourceId,
          sourceName,
        );
        set((state) => {
          state.playerState.isPlaying = true;
          state.songlist.isShuffleActive = Boolean(shuffle);
          state.songlist.contextQueue.sourceName =
            sourceName !== undefined
              ? sourceName || null
              : state.songlist.contextQueue.sourceName;
        });
        return;
      }

      const normalizedId = normalizeSourceId(sourceId);
      const { contextQueue } = get().songlist;
      const listsAreEqual = areSongListsEqual(contextQueue.songs, songlist);
      const sameIndex = contextQueue.currentIndex === index;
      const sameSourceId =
        JSON.stringify(contextQueue.sourceId) === JSON.stringify(normalizedId);

      if (listsAreEqual && sameIndex && !shuffle) {
        set((state) => {
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (listsAreEqual && !sameIndex && !shuffle && sameSourceId) {
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
          state.songlist.contextQueue.currentIndex = index;
          resetUserQueue(state.songlist);
          if (sourceName !== undefined) {
            state.songlist.contextQueue.sourceName = sourceName || null;
          }
        });
        return;
      }

      if (shuffle) {
        const upcoming = songlist.slice(index + 1);
        const shuffledUpcoming = shuffleWithGapAvoidance(upcoming, []);
        const shuffledSongs = [
          ...songlist.slice(0, index + 1),
          ...shuffledUpcoming,
        ];

        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.songlist.contextQueue = {
            ...emptyContextQueue(),
            songs: shuffledSongs,
            currentIndex: index,
            sourceId: normalizedId,
            sourceName:
              sourceName !== undefined
                ? sourceName || null
                : state.songlist.contextQueue.sourceName,
          };
          resetUserQueue(state.songlist);
          state.songlist.originalContextSongs = [...songlist];
          state.songlist.radioList = [];
          state.songlist.shuffleHistory = [];
          state.songlist.isShuffleActive = true;
          state.playerState.mediaType = "song";
          state.playerState.isPlaying = true;
        });
      } else {
        const trimmed = trimQueueToWindow(songlist, index);
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.songlist.contextQueue = {
            ...emptyContextQueue(),
            songs: trimmed.songs,
            currentIndex: trimmed.currentIndex,
            sourceId: normalizedId,
            sourceName:
              sourceName !== undefined
                ? sourceName || null
                : state.songlist.contextQueue.sourceName,
          };
          resetUserQueue(state.songlist);
          state.songlist.originalContextSongs = [];
          state.songlist.radioList = [];
          state.songlist.shuffleHistory = [];
          state.songlist.isShuffleActive = false;
          state.playerState.mediaType = "song";
          state.playerState.isPlaying = true;
        });
      }
    },

    playFromQueue: (contextSongs: ISong[], contextIndex: number) => {
      if (!contextSongs || contextSongs.length === 0) return;
      contextIndex = Math.max(
        0,
        Math.min(contextIndex, contextSongs.length - 1),
      );

      if (isRemoteActive()) {
        const song = contextSongs[contextIndex];
        if (song) {
          remoteSend(LanControlMessageType.PLAY_SONG, { songId: song.id });
        }
        return;
      }

      const { contextQueue } = get().songlist;
      const listsAreEqual = areSongListsEqual(contextQueue.songs, contextSongs);

      if (listsAreEqual) {
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
          state.songlist.contextQueue.currentIndex = contextIndex;
          state.songlist.isInUserQueue = false;
        });
        return;
      }

      set((state) => {
        const trimmed = trimQueueToWindow(contextSongs, contextIndex);
        state.playerProgress.progress = 0;
        state.songlist.contextQueue = {
          ...emptyContextQueue(),
          songs: trimmed.songs,
          currentIndex: trimmed.currentIndex,
          sourceId: state.songlist.contextQueue.sourceId,
          sourceName: state.songlist.contextQueue.sourceName,
        };
        resetUserQueue(state.songlist);
        state.songlist.originalContextSongs = [];
        state.songlist.isShuffleActive = false;
        state.songlist.shuffleHistory = [];
        state.playerState.mediaType = "song";
        state.playerState.isPlaying = true;
        state.songlist.radioList = [];
      });
    },

    playFromUserQueue: (userQueueIndex: number) => {
      if (isRemoteActive()) {
        const { userQueue } = get().songlist;
        const song = userQueue.songs[userQueueIndex];
        if (song) {
          remoteSend(LanControlMessageType.PLAY_SONG, { songId: song.id });
        }
        return;
      }
      const { userQueue } = get().songlist;
      if (userQueueIndex < 0 || userQueueIndex >= userQueue.songs.length)
        return;

      set((state) => {
        const songsBefore = state.songlist.userQueue.songs.splice(
          0,
          userQueueIndex,
        );
        state.songlist.playedUserQueueHistory.push(...songsBefore);
        state.songlist.isInUserQueue = true;
        state.playerProgress.progress = 0;
        state.playerState.isPlaying = true;
      });
    },

    playSong: (song: ISong, sourceName?: string) => {
      if (remoteSend(LanControlMessageType.PLAY_SONG, { songId: song.id })) {
        return;
      }
      const { isPlaying } = get().playerState;
      const songIsAlreadyPlaying = get().actions.checkActiveSong(song.id);
      if (songIsAlreadyPlaying && !isPlaying) {
        set((state) => {
          state.playerState.isPlaying = true;
        });
      } else {
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.mediaType = "song";
          state.songlist.contextQueue = {
            ...emptyContextQueue(),
            songs: [song],
            currentIndex: 0,
            sourceName:
              sourceName !== undefined
                ? sourceName || null
                : song.album || null,
          };
          resetUserQueue(state.songlist);
          state.songlist.originalContextSongs = [];
          state.songlist.isShuffleActive = false;
          state.songlist.shuffleHistory = [];
          state.playerState.isPlaying = true;
          state.songlist.radioList = [];
        });
      }
    },

    setNextOnQueue: (
      list: ISong[],
      sourceId?: QueueSourceId | { albumId: string } | { playlistId: string },
    ) => {
      if (isRemoteActive()) {
        if (list.length === 0) return;
        sendAddToQueueRemote(remoteSend, sourceId, list);
        return;
      }
      if (!list || list.length === 0) return;

      set((state) => {
        state.songlist.userQueue.songs = setNextOnUserQueue(
          state.songlist.userQueue.songs,
          list,
        );
      });
    },

    setLastOnQueue: (
      list: ISong[],
      sourceId?: QueueSourceId | { albumId: string } | { playlistId: string },
    ) => {
      if (isRemoteActive()) {
        if (list.length === 0) return;
        sendAddToQueueRemote(remoteSend, sourceId, list);
        return;
      }
      if (!list || list.length === 0) return;

      set((state) => {
        state.songlist.userQueue.songs = setLastOnUserQueue(
          state.songlist.userQueue.songs,
          list,
        );
      });
    },

    removeSongFromQueue: (id: string, tier?: QueueTier) => {
      if (isRemoteActive()) return;
      const detectedTier = tier ?? findSongTier(get().songlist, id);
      if (!detectedTier) return;

      if (detectedTier === "user") {
        const { userQueue, isInUserQueue } = get().songlist;
        const removedIndex = userQueue.songs.findIndex((s) => s.id === id);
        if (removedIndex === -1) return;

        const newUserSongs = [...userQueue.songs];
        newUserSongs.splice(removedIndex, 1);

        set((state) => {
          state.songlist.userQueue.songs = newUserSongs;
          if (
            isInUserQueue &&
            removedIndex === 0 &&
            newUserSongs.length === 0
          ) {
            state.songlist.isInUserQueue = false;
          }
        });
        return;
      }

      const { contextQueue, isInUserQueue } = get().songlist;
      const removedIndex = contextQueue.songs.findIndex((s) => s.id === id);
      if (removedIndex === -1) return;

      const newSongs = [...contextQueue.songs];
      newSongs.splice(removedIndex, 1);

      if (newSongs.length === 0) {
        get().actions.clearPlayerState();
        return;
      }

      const shouldResetProgress =
        removedIndex === contextQueue.currentIndex && !isInUserQueue;

      set((state) => {
        let newIndex: number;
        if (isInUserQueue) {
          newIndex =
            contextQueue.currentIndex -
            (removedIndex <= contextQueue.currentIndex ? 1 : 0);
        } else {
          if (removedIndex < contextQueue.currentIndex) {
            newIndex = contextQueue.currentIndex - 1;
          } else if (removedIndex === contextQueue.currentIndex) {
            newIndex = Math.min(contextQueue.currentIndex, newSongs.length - 1);
          } else {
            newIndex = contextQueue.currentIndex;
          }
        }
        newIndex = Math.max(newIndex, 0);

        state.songlist.contextQueue.songs = newSongs;
        state.songlist.contextQueue.currentIndex = newIndex;
        state.songlist.originalContextSongs =
          state.songlist.originalContextSongs.filter((s) => s.id !== id);
        if (shouldResetProgress) {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
        }
      });
    },

    clearUserQueue: () => {
      set((state) => {
        state.songlist.userQueue.songs = [];
        state.songlist.playedUserQueueHistory = [];
        if (state.songlist.isInUserQueue) {
          state.songlist.isInUserQueue = false;
        }
      });
    },

    reorderQueue: (fromIndex: number, toIndex: number) => {
      if (isRemoteActive()) return;
      if (fromIndex === toIndex) return;

      const { contextQueue, userQueue } = get().songlist;
      const contextPlayedCount = contextQueue.currentIndex + 1;

      const fromInUser =
        fromIndex >= contextPlayedCount &&
        fromIndex < contextPlayedCount + userQueue.songs.length;
      const toInUser =
        toIndex >= contextPlayedCount &&
        toIndex < contextPlayedCount + userQueue.songs.length;

      const fromInUpcoming =
        fromIndex >= contextPlayedCount + userQueue.songs.length;
      const toInUpcoming =
        toIndex >= contextPlayedCount + userQueue.songs.length;

      if (fromInUser && toInUser) {
        const localFrom = fromIndex - contextPlayedCount;
        const localTo = toIndex - contextPlayedCount;
        const newUserSongs = [...userQueue.songs];
        const moved = newUserSongs.splice(localFrom, 1)[0];
        newUserSongs.splice(localTo, 0, moved);
        set((state) => {
          state.songlist.userQueue.songs = newUserSongs;
        });
        return;
      }

      if (fromInUpcoming && toInUpcoming) {
        const localFrom = fromIndex - userQueue.songs.length;
        const localTo = toIndex - userQueue.songs.length;
        const newContextSongs = [...contextQueue.songs];
        const moved = newContextSongs.splice(localFrom, 1)[0];
        newContextSongs.splice(localTo, 0, moved);
        set((state) => {
          state.songlist.contextQueue.songs = newContextSongs;
        });
        return;
      }

      if (fromInUser && toInUpcoming) {
        const localFrom = fromIndex - contextPlayedCount;
        const song = userQueue.songs[localFrom];
        if (!song) return;
        const newUserSongs = [...userQueue.songs];
        newUserSongs.splice(localFrom, 1);
        const contextInsertAt = toIndex - userQueue.songs.length;
        const newContextSongs = [...contextQueue.songs];
        newContextSongs.splice(contextInsertAt, 0, song);
        set((state) => {
          state.songlist.userQueue.songs = newUserSongs;
          state.songlist.contextQueue.songs = newContextSongs;
        });
        return;
      }

      if (fromInUpcoming && toInUser) {
        const localFrom = fromIndex - userQueue.songs.length;
        const song = contextQueue.songs[localFrom];
        if (!song) return;
        const newContextSongs = [...contextQueue.songs];
        newContextSongs.splice(localFrom, 1);
        const localTo = toIndex - contextPlayedCount;
        const newUserSongs = [...userQueue.songs];
        newUserSongs.splice(localTo, 0, song);
        set((state) => {
          state.songlist.contextQueue.songs = newContextSongs;
          state.songlist.userQueue.songs = newUserSongs;
        });
        return;
      }
    },

    toggleShuffle: () => {
      if (isRemoteActive()) {
        remoteSend(LanControlMessageType.TOGGLE_SHUFFLE);
        set((state) => {
          state.songlist.isShuffleActive = !state.songlist.isShuffleActive;
        });
        return;
      }

      const { isShuffleActive } = get().songlist;
      if (isShuffleActive) {
        set((state) => {
          applyShuffleOff(state.songlist);
        });
      } else {
        set((state) => {
          applyShuffleOn(state.songlist);
        });
      }
    },

    playNextSong: () => {
      if (isRemoteActive()) {
        if (remoteSend(LanControlMessageType.NEXT)) return;
      }
      const now = Date.now();
      if (now - lastNextSongTime < NEXT_SONG_DEBOUNCE_MS) return;
      lastNextSongTime = now;

      const { loopState } = get().playerState;
      const songlist = get().songlist;

      if (!hasNextEffectiveSong(songlist, loopState)) return;

      const { isInUserQueue, userQueue, contextQueue } = songlist;

      if (isInUserQueue) {
        const consumed = userQueue.songs[0];
        set((state) => {
          state.songlist.userQueue.songs.splice(0, 1);
          state.songlist.playedUserQueueHistory.push(consumed);
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;

          if (state.songlist.userQueue.songs.length > 0) {
            state.playerState.isPlaying = true;
          } else {
            state.songlist.isInUserQueue = false;
            if (
              state.songlist.contextQueue.currentIndex <
              state.songlist.contextQueue.songs.length - 1
            ) {
              state.songlist.contextQueue.currentIndex += 1;
            } else if (loopState === LoopState.All) {
              const lastPlayedSongId =
                songlist.contextQueue.songs[songlist.contextQueue.currentIndex]
                  ?.id;
              state.songlist.contextQueue.currentIndex = 0;
              reshuffleContextForWrap(state.songlist, lastPlayedSongId);
            }
            state.playerState.isPlaying = true;
          }
        });
        return;
      }

      if (userQueue.songs.length > 0) {
        set((state) => {
          state.songlist.isInUserQueue = true;
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (loopState === LoopState.One) {
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
        });
        const audioRef = get().playerState.audioPlayerRef;
        if (audioRef) {
          audioRef.currentTime = 0;
          audioRef.play().catch(() => {});
        }
        return;
      }

      if (contextQueue.currentIndex < contextQueue.songs.length - 1) {
        set((state) => {
          state.songlist.contextQueue.currentIndex += 1;
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (loopState === LoopState.All) {
        const lastPlayedSongId =
          songlist.contextQueue.songs[songlist.contextQueue.currentIndex]?.id;
        set((state) => {
          state.songlist.contextQueue.currentIndex = 0;
          reshuffleContextForWrap(state.songlist, lastPlayedSongId);
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
        });
      }
    },

    playPrevSong: () => {
      if (isRemoteActive()) {
        if (remoteSend(LanControlMessageType.PREVIOUS)) return;
      }

      const currentSong = getCurrentSong(get().songlist);
      const progress = get().playerProgress.progress;

      if (currentSong && progress > PREV_SEEK_THRESHOLD) {
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
        });
        lastPrevSongTime = Date.now();
        const audioRef = get().playerState.audioPlayerRef;
        if (audioRef) {
          audioRef.currentTime = 0;
        }
        return;
      }

      const now = Date.now();
      if (now - lastPrevSongTime < PREV_SONG_DEBOUNCE_MS) return;
      lastPrevSongTime = now;

      if (!hasPrevEffectiveSong(get().songlist)) return;

      const { isInUserQueue, playedUserQueueHistory, contextQueue } =
        get().songlist;

      if (playedUserQueueHistory.length > 0) {
        const wasInUserQueue = isInUserQueue;
        set((state) => {
          const history = state.songlist.playedUserQueueHistory;
          const restored = history.pop()!;
          state.songlist.userQueue.songs.unshift(restored);
          state.songlist.isInUserQueue = true;
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;

          if (!wasInUserQueue) {
            state.songlist.contextQueue.currentIndex = Math.max(
              0,
              state.songlist.contextQueue.currentIndex - 1,
            );
          }

          state.playerState.isPlaying = true;
        });
        return;
      }

      if (isInUserQueue) {
        set((state) => {
          state.songlist.isInUserQueue = false;
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (contextQueue.currentIndex > 0) {
        set((state) => {
          state.songlist.contextQueue.currentIndex -= 1;
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
        });
      }
    },

    hasNextSong: () => {
      return hasNextEffectiveSong(get().songlist, get().playerState.loopState);
    },

    hasPrevSong: () => {
      return hasPrevEffectiveSong(get().songlist);
    },

    isPlayingOneSong: () => {
      return isPlayingOneSong(get().songlist);
    },

    setPlayRadio: (list: Radio[], index: number) => {
      if (isRemoteActive()) return;
      if (!list || list.length === 0) return;
      index = Math.max(0, Math.min(index, list.length - 1));

      const { mediaType } = get().playerState;
      const { radioList, contextQueue } = get().songlist;

      if (
        mediaType === "radio" &&
        radioList.length > 0 &&
        list[index]?.id === radioList[contextQueue.currentIndex]?.id
      ) {
        set((state) => {
          state.playerState.isPlaying = true;
        });
        return;
      }

      get().actions.clearPlayerState();
      set((state) => {
        state.playerState.mediaType = "radio";
        state.songlist.radioList = list;
        state.songlist.contextQueue.currentIndex = index;
        state.playerState.isPlaying = true;
      });
    },

    handleSongEnded: () => {
      if (isRemoteActive()) return;
      const { loopState } = get().playerState;
      const songlist = get().songlist;

      const userQueueRemaining = songlist.isInUserQueue
        ? songlist.userQueue.songs.length - 1
        : songlist.userQueue.songs.length;
      // LoopState.One means repeat the current song indefinitely;
      // user queue songs are not advanced to in this mode.
      const hasNext =
        loopState === LoopState.One
          ? userQueueRemaining > 0
          : hasNextEffectiveSong(songlist, loopState);

      if (hasNext) {
        get().actions.playNextSong();
      } else if (loopState === LoopState.One) {
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = true;
        });
        const audioRef = get().playerState.audioPlayerRef;
        if (audioRef) {
          audioRef.currentTime = 0;
          audioRef.play().catch(() => {});
        }
      } else {
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerProgress.bufferedProgress = 0;
          state.playerState.isPlaying = false;
        });
      }
    },

    clearPlayerState: () => {
      if (isRemoteActive()) return;
      set((state) => {
        clearSonglistState(state.songlist);
        state.playerState.mediaType = "song";
        state.playerState.isPlaying = false;
        state.playerState.loopState = LoopState.Off;
        state.playerState.mainDrawerState = false;
        state.playerState.queueState = false;
        state.playerState.lyricsState = false;
        state.playerState.currentDuration = 0;
        state.playerState.audioPlayerRef = null;
        state.playerState.isBuffering = false;
        state.settings.colors.currentSongColor = null;
      });
    },

    checkActiveSong: (id: string) => {
      const currentSong = getCurrentSong(get().songlist);
      return currentSong ? id === currentSong.id : false;
    },

    setCurrentSong: () => {
      if (isRemoteActive()) return;
      const song = getCurrentSong(get().songlist);
      set((state) => {
        state.songlist.currentSong = song;
        state.playerState.currentDuration = song?.duration
          ? Math.round(song.duration)
          : 0;
        if (state.songlist.isShuffleActive && song?.id) {
          const history = state.songlist.shuffleHistory;
          const idx = history.indexOf(song.id);
          if (idx !== -1) {
            history.splice(idx, 1);
          }
          history.push(song.id);
          if (history.length > MAX_SHUFFLE_HISTORY) {
            history.splice(0, history.length - MAX_SHUFFLE_HISTORY);
          }
        }
      });
    },

    checkIsSongStarred: () => {
      const song = getCurrentSong(get().songlist);
      const { mediaType } = get().playerState;

      if (mediaType === "song" && song) {
        const isStarred = typeof song.starred === "string";
        set((state) => {
          state.playerState.isSongStarred = isStarred;
        });
      } else {
        set((state) => {
          state.playerState.isSongStarred = false;
        });
      }
    },

    updateQueueChecks: () => {
      const songlist = get().songlist;
      const { loopState } = get().playerState;
      const hasPrev = hasPrevEffectiveSong(songlist);
      const hasNext = hasNextEffectiveSong(songlist, loopState);

      set((state) => {
        state.playerState.hasPrev = hasPrev;
        state.playerState.hasNext = hasNext;
      });
    },
  } satisfies IPlayerActions;
}
