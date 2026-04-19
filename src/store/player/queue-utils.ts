import type { Draft } from "immer";
import type {
  IContextQueue,
  IPlayerContext,
  ISongList,
} from "@/types/playerContext";
import { LoopState } from "@/types/playerContext";
import { LanControlMessageType } from "@/types/lanControl";
import type { ISong } from "@/types/responses/song";
import { shuffleWithGapAvoidance } from "@/utils/songListFunctions";

export function getCurrentSong(songlist: ISongList): ISong | null {
  if (songlist.userQueuePosition > 0) {
    const idx = songlist.userQueuePosition - 1;
    return songlist.userQueue.songs[idx] ?? null;
  }
  return songlist.contextQueue.songs[songlist.contextQueue.currentIndex] ?? null;
}

export function getEffectiveQueue(songlist: ISongList): ISong[] {
  const { contextQueue, userQueue } = songlist;
  const played = contextQueue.songs.slice(0, contextQueue.currentIndex + 1);
  const upcoming = contextQueue.songs.slice(contextQueue.currentIndex + 1);
  return [...played, ...userQueue.songs, ...upcoming];
}

export function getEffectiveIndex(songlist: ISongList): number {
  if (songlist.userQueuePosition > 0) {
    return (
      songlist.contextQueue.currentIndex + songlist.userQueuePosition
    );
  }
  return songlist.contextQueue.currentIndex;
}

export function hasNextEffectiveSong(
  songlist: ISongList,
  loopState: LoopState,
): boolean {
  const { userQueuePosition, userQueue, contextQueue } = songlist;
  const remainingUserSongs = userQueue.songs.length - userQueuePosition;
  const remainingContextSongs =
    contextQueue.songs.length - contextQueue.currentIndex - 1;
  return remainingUserSongs > 0 || remainingContextSongs > 0 || loopState === LoopState.All;
}

export function hasPrevEffectiveSong(songlist: ISongList): boolean {
  if (songlist.userQueuePosition > 0) return true;
  return songlist.contextQueue.currentIndex > 0;
}

export function isPlayingOneSong(songlist: ISongList): boolean {
  const total = songlist.contextQueue.songs.length + songlist.userQueue.songs.length;
  return total <= 1;
}

export function findSongTier(
  songlist: ISongList,
  id: string,
): "context" | "user" | null {
  if (songlist.userQueue.songs.some((s) => s.id === id)) return "user";
  if (songlist.contextQueue.songs.some((s) => s.id === id)) return "context";
  return null;
}

export function dedupAgainstExisting(
  incoming: ISong[],
  existing: ISong[],
): ISong[] {
  const existingIds = new Set(existing.map((s) => s.id));
  const seen = new Set<string>();
  return incoming.filter((s) => {
    if (existingIds.has(s.id) || seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export function applyShuffleOn(state: Draft<ISongList>): void {
  const { contextQueue } = state;
  if (contextQueue.songs.length + state.userQueue.songs.length <= 1) return;

  const isLastContextSong =
    contextQueue.currentIndex >= contextQueue.songs.length - 1;
  if (isLastContextSong && state.userQueue.songs.length === 0) return;

  state.originalContextSongs = [...contextQueue.songs];

  const upcoming = contextQueue.songs.slice(contextQueue.currentIndex + 1);
  if (upcoming.length > 0) {
    const shuffledUpcoming = shuffleWithGapAvoidance(
      upcoming,
      state.shuffleHistory,
    );
    contextQueue.songs = [
      ...contextQueue.songs.slice(0, contextQueue.currentIndex + 1),
      ...shuffledUpcoming,
    ];
  }

  if (state.userQueue.songs.length > 0) {
    state.originalUserSongs = [...state.userQueue.songs];
    state.userQueue.songs = shuffleWithGapAvoidance(
      [...state.userQueue.songs],
      state.shuffleHistory,
    );
  }

  state.isShuffleActive = true;
}

export function applyShuffleOff(state: Draft<ISongList>): void {
  const currentSongId = getCurrentSong(state as ISongList)?.id;
  const original = state.originalContextSongs;

  if (original.length > 0) {
    const newIdx = currentSongId
      ? original.findIndex((s) => s.id === currentSongId)
      : 0;
    state.contextQueue.songs = [...original];
    state.contextQueue.currentIndex = newIdx >= 0 ? newIdx : 0;
    state.userQueuePosition = 0;
  }

  if (state.originalUserSongs && state.originalUserSongs.length > 0) {
    state.userQueue.songs = [...state.originalUserSongs];
  }
  state.originalUserSongs = undefined;

  state.isShuffleActive = false;
  state.shuffleHistory = [];
}

export function clearSonglistState(state: Draft<ISongList>): void {
  state.contextQueue = emptyContextQueue();
  state.userQueue = { songs: [] };
  state.originalContextSongs = [];
  state.currentSong = null;
  state.radioList = [];
  state.isShuffleActive = false;
  state.userQueuePosition = 0;
  state.shuffleHistory = [];
}

export function initSonglistState(): ISongList {
  return {
    contextQueue: emptyContextQueue(),
    userQueue: { songs: [] },
    originalContextSongs: [],
    currentSong: null,
    radioList: [],
    isShuffleActive: false,
    userQueuePosition: 0,
    shuffleHistory: [],
  };
}

export function setNextOnUserQueue(
  existingUser: ISong[],
  incoming: ISong[],
): ISong[] {
  return [...incoming, ...existingUser];
}

export function setLastOnUserQueue(
  existingUser: ISong[],
  incoming: ISong[],
): ISong[] {
  return [...existingUser, ...incoming];
}

export function emptyContextQueue(
  overrides?: Partial<IContextQueue>,
): IContextQueue {
  return {
    songs: [],
    currentIndex: 0,
    sourceId: null,
    sourceName: null,
    ...overrides,
  };
}

export function resetPlaybackState(state: Draft<IPlayerContext>): void {
  state.playerState.isPlaying = false;
  state.playerState.isBuffering = false;
  state.playerProgress.progress = 0;
  state.playerState.currentDuration = 0;
  state.songlist.isShuffleActive = false;
  state.songlist.shuffleHistory = [];
  state.playerState.loopState = LoopState.Off;
  state.playerState.hasPrev = false;
  state.playerState.hasNext = false;
}

export function applyStarToAllLists(
  state: Draft<ISongList>,
  id: string,
  newStarred: string | undefined,
): void {
  for (const list of [
    state.contextQueue.songs,
    state.userQueue.songs,
    state.originalContextSongs,
  ]) {
    const song = list.find((s) => s.id === id);
    if (song) {
      song.starred = newStarred;
    }
  }
  if (state.currentSong?.id === id) {
    state.currentSong = { ...state.currentSong, starred: newStarred };
  }
}

export function hasAnySongs(songlist: ISongList): boolean {
  return songlist.contextQueue.songs.length > 0 || songlist.userQueue.songs.length > 0;
}

export function sendAddToQueueRemote(
  remoteSend: (type: unknown, data?: unknown) => boolean,
  sourceId: { albumId: string } | { playlistId: string } | undefined,
  list: ISong[],
): void {
  if (sourceId && "albumId" in sourceId) {
    remoteSend(LanControlMessageType.ADD_ALBUM_TO_QUEUE, {
      albumId: sourceId.albumId,
    });
  } else if (sourceId && "playlistId" in sourceId) {
    remoteSend(LanControlMessageType.ADD_PLAYLIST_TO_QUEUE, {
      playlistId: sourceId.playlistId,
    });
  } else {
    remoteSend(LanControlMessageType.ADD_TO_QUEUE, {
      songIds: list.map((song) => song.id),
    });
  }
}

export function reshuffleContextForWrap(
  state: Draft<ISongList>,
  lastPlayedSongId: string | undefined,
): void {
  if (!state.isShuffleActive || state.contextQueue.songs.length <= 1) return;

  const upcoming = state.contextQueue.songs.slice(1);
  const reshuffled = shuffleWithGapAvoidance(upcoming, state.shuffleHistory);

  if (lastPlayedSongId) {
    const lastIdx = reshuffled.findIndex((s) => s.id === lastPlayedSongId);
    if (lastIdx !== -1) {
      const [lastSong] = reshuffled.splice(lastIdx, 1);
      reshuffled.push(lastSong);
    }
  }

  state.contextQueue.songs = [
    state.contextQueue.songs[0],
    ...reshuffled,
  ];
}