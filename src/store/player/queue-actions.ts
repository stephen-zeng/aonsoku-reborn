import type { Draft } from "immer";
import type {
  IPlayerActions,
  IPlayerContext,
  ISongList,
  QueueTier,
} from "@/types/playerContext";
import { LoopState } from "@/types/playerContext";
import type { ISong } from "@/types/responses/song";
import type { Radio } from "@/types/responses/radios";
import { LanControlMessageType } from "@/types/lanControl";
import { areSongListsEqual } from "@/utils/compareSongLists";
import { shuffleSongList } from "@/utils/songListFunctions";
import {
  applyShuffleOff,
  applyShuffleOn,
  dedupAgainstExisting,
  emptyContextQueue,
  findSongTier,
  getCurrentSong,
  getEffectiveQueue,
  hasNextEffectiveSong,
  hasPrevEffectiveSong,
  isPlayingOneSong,
  sendAddToQueueRemote,
  setLastOnUserQueue,
  setNextOnUserQueue,
} from "./queue-utils";

interface SharedDeps {
  set: (fn: (state: Draft<IPlayerContext>) => void) => void;
  get: () => IPlayerContext;
  isRemoteActive: () => boolean;
  remoteSend: (type: LanControlMessageType, data?: unknown) => boolean;
  clearSonglistState: (state: Draft<ISongList>) => void;
}

export function createQueueActions(shared: SharedDeps) {
  const { set, get, isRemoteActive, remoteSend, clearSonglistState } = shared;
  const PREV_SEEK_THRESHOLD = 3;

  return {
    setSongList: (
      songlist: ISong[],
      index: number,
      shuffle = false,
      sourceId?:
        | { albumId: string }
        | { playlistId: string },
      sourceName?: string,
    ) => {
      if (isRemoteActive()) {
        if (songlist.length === 0) return;
        if (sourceId && "albumId" in sourceId) {
          const messageType = shuffle
            ? LanControlMessageType.PLAY_ALBUM_SHUFFLE
            : LanControlMessageType.PLAY_ALBUM;
          remoteSend(messageType, {
            albumId: sourceId.albumId,
            songIndex: index,
          });
        } else if (sourceId && "playlistId" in sourceId) {
          const messageType = shuffle
            ? LanControlMessageType.PLAY_PLAYLIST_SHUFFLE
            : LanControlMessageType.PLAY_PLAYLIST;
          remoteSend(messageType, {
            playlistId: sourceId.playlistId,
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

      const { contextQueue } = get().songlist;
      const listsAreEqual = areSongListsEqual(
        contextQueue.songs,
        songlist,
      );
      const sameIndex = contextQueue.currentIndex === index;
      const sameSourceId =
        JSON.stringify(contextQueue.sourceId) ===
        JSON.stringify(sourceId ?? null);

      if (listsAreEqual && sameIndex && !shuffle) {
        set((state) => {
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (listsAreEqual && !sameIndex && !shuffle && sameSourceId) {
        get().actions.resetProgress();
        set((state) => {
          state.playerState.isPlaying = true;
          state.songlist.contextQueue.currentIndex = index;
          state.songlist.userQueue = { songs: [] };
          state.songlist.userQueuePosition = 0;
          if (sourceName !== undefined) {
            state.songlist.contextQueue.sourceName = sourceName || null;
          }
        });
        return;
      }

      get().actions.resetProgress();

      set((state) => {
        state.songlist.contextQueue = {
          ...emptyContextQueue(),
          songs: [...songlist],
          currentIndex: index,
          sourceId: sourceId ?? null,
          sourceName:
            sourceName !== undefined
              ? sourceName || null
              : state.songlist.contextQueue.sourceName,
        };
        state.songlist.userQueue = { songs: [] };
        state.songlist.originalContextSongs = [...songlist];
        state.songlist.radioList = [];
        state.songlist.userQueuePosition = 0;
        state.playerState.mediaType = "song";
      });

      if (shuffle) {
        const { contextQueue } = get().songlist;
        const upcoming = contextQueue.songs.slice(index + 1);
        const shuffledUpcoming = shuffleSongList(upcoming, 0);

        set((state) => {
          state.songlist.contextQueue.songs = [
            ...state.songlist.contextQueue.songs.slice(0, index + 1),
            ...shuffledUpcoming,
          ];
          state.songlist.isShuffleActive = true;
          state.songlist.originalContextSongs = [...songlist];
          state.playerState.isPlaying = true;
        });
      } else {
        set((state) => {
          state.songlist.isShuffleActive = false;
          state.playerState.isPlaying = true;
        });
      }
    },

    playSong: (song: ISong, sourceName?: string) => {
      if (
        remoteSend(LanControlMessageType.PLAY_SONG, { songId: song.id })
      ) {
        return;
      }
      const { isPlaying } = get().playerState;
      const songIsAlreadyPlaying = get().actions.checkActiveSong(song.id);
      if (songIsAlreadyPlaying && !isPlaying) {
        set((state) => {
          state.playerState.isPlaying = true;
        });
      } else {
        get().actions.resetProgress();
        set((state) => {
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
          state.songlist.userQueue = { songs: [] };
          state.songlist.originalContextSongs = [song];
          state.songlist.isShuffleActive = false;
          state.songlist.userQueuePosition = 0;
          state.playerState.isPlaying = true;
          state.songlist.radioList = [];
        });
      }
    },

    setNextOnQueue: (
      list: ISong[],
      sourceId?:
        | { albumId: string }
        | { playlistId: string },
    ) => {
      if (isRemoteActive()) {
        if (list.length === 0) return;
        sendAddToQueueRemote(remoteSend, sourceId, list);
        return;
      }

      const effective = getEffectiveQueue(get().songlist);
      const uniqueList = dedupAgainstExisting(list, effective);
      if (uniqueList.length === 0) return;

      set((state) => {
        state.songlist.userQueue.songs = setNextOnUserQueue(
          state.songlist.userQueue.songs,
          uniqueList,
        );
      });
    },

    setLastOnQueue: (
      list: ISong[],
      sourceId?:
        | { albumId: string }
        | { playlistId: string },
    ) => {
      if (isRemoteActive()) {
        if (list.length === 0) return;
        sendAddToQueueRemote(remoteSend, sourceId, list);
        return;
      }

      const effective = getEffectiveQueue(get().songlist);
      const uniqueList = dedupAgainstExisting(list, effective);
      if (uniqueList.length === 0) return;

      set((state) => {
        state.songlist.userQueue.songs = setLastOnUserQueue(
          state.songlist.userQueue.songs,
          uniqueList,
        );
      });
    },

    removeSongFromQueue: (id: string, tier?: QueueTier) => {
      if (isRemoteActive()) return;
      const detectedTier = tier ?? findSongTier(get().songlist, id);
      if (!detectedTier) return;

      if (detectedTier === "user") {
        const { userQueue, userQueuePosition } = get().songlist;
        const removedIndex = userQueue.songs.findIndex((s) => s.id === id);
        if (removedIndex === -1) return;

        const newUserSongs = [...userQueue.songs];
        newUserSongs.splice(removedIndex, 1);

        let newUserPos = userQueuePosition;
        if (userQueuePosition > 0 && removedIndex === userQueuePosition - 1) {
          newUserPos = newUserSongs.length > 0
            ? Math.min(userQueuePosition, newUserSongs.length)
            : 0;
        } else if (removedIndex >= 0 && removedIndex < userQueuePosition - 1) {
          newUserPos = userQueuePosition - 1;
        }

        set((state) => {
          state.songlist.userQueue.songs = newUserSongs;
          state.songlist.userQueuePosition = newUserPos;
        });
        return;
      }

      const { contextQueue } = get().songlist;
      const removedIndex = contextQueue.songs.findIndex((s) => s.id === id);
      if (removedIndex === -1) return;

      const newSongs = [...contextQueue.songs];
      newSongs.splice(removedIndex, 1);

      if (newSongs.length === 0) {
        get().actions.clearPlayerState();
        return;
      }

      if (removedIndex === contextQueue.currentIndex && get().songlist.userQueuePosition === 0) {
        get().actions.resetProgress();
      }

      const newIndex = Math.min(
        contextQueue.currentIndex -
          (removedIndex < contextQueue.currentIndex ? 1 : 0),
        newSongs.length - 1,
      );

      set((state) => {
        state.songlist.contextQueue.songs = newSongs;
        state.songlist.contextQueue.currentIndex = Math.max(newIndex, 0);
        state.songlist.originalContextSongs =
          state.songlist.originalContextSongs.filter((s) => s.id !== id);
      });
    },

    clearUserQueue: () => {
      set((state) => {
        state.songlist.userQueue.songs = [];
        state.songlist.userQueuePosition = 0;
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

      const fromInUpcoming = fromIndex >= contextPlayedCount + userQueue.songs.length;
      const toInUpcoming = toIndex >= contextPlayedCount + userQueue.songs.length;

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
      if (remoteSend(LanControlMessageType.NEXT)) return;
      const { loopState } = get().playerState;
      const songlist = get().songlist;

      if (!hasNextEffectiveSong(songlist, loopState)) return;
      get().actions.resetProgress();

      const { userQueuePosition, userQueue, contextQueue } = songlist;
      const userSongsAfterCurrent = userQueue.songs.length - userQueuePosition;

      if (userQueuePosition > 0 && userSongsAfterCurrent > 0) {
        set((state) => {
          state.songlist.userQueuePosition += 1;
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (userQueuePosition > 0 && userSongsAfterCurrent === 0) {
        if (contextQueue.currentIndex < contextQueue.songs.length - 1) {
          set((state) => {
            state.songlist.userQueuePosition = 0;
            state.songlist.contextQueue.currentIndex += 1;
            state.playerState.isPlaying = true;
          });
        } else if (loopState === LoopState.All) {
          set((state) => {
            state.songlist.userQueuePosition = 0;
            state.songlist.contextQueue.currentIndex = 0;
            state.playerState.isPlaying = true;
          });
        }
        return;
      }

      if (userQueuePosition === 0 && userQueue.songs.length > 0) {
        set((state) => {
          state.songlist.userQueuePosition = 1;
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (contextQueue.currentIndex < contextQueue.songs.length - 1) {
        set((state) => {
          state.songlist.contextQueue.currentIndex += 1;
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (loopState === LoopState.All) {
        set((state) => {
          state.songlist.contextQueue.currentIndex = 0;
          state.playerState.isPlaying = true;
        });
      }
    },

    playPrevSong: () => {
      if (remoteSend(LanControlMessageType.PREVIOUS)) return;

      const currentSong = get().songlist.currentSong;
      const progress = get().playerProgress.progress;

      if (currentSong && progress > PREV_SEEK_THRESHOLD) {
        set((state) => {
          state.playerProgress.progress = 0;
        });
        const audioRef = get().playerState.audioPlayerRef;
        if (audioRef) {
          audioRef.currentTime = 0;
        }
        return;
      }

      if (!hasPrevEffectiveSong(get().songlist)) return;
      get().actions.resetProgress();

      const { userQueuePosition, contextQueue } = get().songlist;

      if (userQueuePosition > 0) {
        set((state) => {
          state.songlist.userQueuePosition -= 1;
          state.playerState.isPlaying = true;
        });
        return;
      }

      if (contextQueue.currentIndex > 0) {
        set((state) => {
          state.songlist.contextQueue.currentIndex -= 1;
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

      if (loopState === LoopState.One) {
        return;
      }

      const songlist = get().songlist;
      if (hasNextEffectiveSong(songlist, loopState)) {
        get().actions.playNextSong();
        set((state) => {
          state.playerProgress.progress = 0;
          state.playerState.isPlaying = true;
        });
      } else if (loopState === LoopState.All) {
        set((state) => {
          state.playerProgress.progress = 0;
          state.songlist.contextQueue.currentIndex = 0;
          state.songlist.userQueuePosition = 0;
          state.playerState.isPlaying = true;
        });
      } else {
        set((state) => {
          state.playerProgress.progress = 0;
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
      const currentSong = get().songlist.currentSong;
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