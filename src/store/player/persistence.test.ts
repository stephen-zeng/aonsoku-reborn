import { describe, expect, it } from "vitest";
import type { IPlayerContext, ISongList } from "@/types/playerContext";
import type { ISong } from "@/types/responses/song";
import { MAX_SHUFFLE_START_HISTORY } from "@/utils/songListFunctions";
import {
  createInitialSettings,
  initialPlayerProgress,
  initialPlayerState,
  initialRemoteControl,
  initialSonglist,
} from "./initial-state";
import {
  migrateLegacySonglist,
  migratePlayerStoreState,
  migrateSonglistFromIdb,
  partializePlayerStoreState,
  trimSonglistForIdb,
} from "./persistence";
import { MAX_QUEUE_SIZE, MAX_USER_QUEUE_IDB_SIZE } from "./queue-utils";

function makeSong(id: string): ISong {
  return { id, duration: 180 } as ISong;
}

describe("player persistence migrations", () => {
  it("migrates v1 songlist shape into context and user queues", () => {
    const songs = [makeSong("song-1"), makeSong("song-2")];
    const persistedState = {
      songlist: {
        currentList: songs,
        originalList: songs,
        currentSong: songs[1],
        currentSongIndex: 1,
        queueSource: "Album",
        radioList: [],
        isShuffleActive: true,
      },
      playerState: {
        isShuffleActive: true,
      },
    };

    const migrated = migratePlayerStoreState(persistedState, 1);

    expect(migrated.songlist.contextQueue).toEqual({
      songs,
      currentIndex: 1,
      sourceId: null,
      sourceName: "Album",
    });
    expect(migrated.songlist.userQueue).toEqual({ songs: [] });
    expect(migrated.songlist.isInUserQueue).toBe(false);
    expect(migrated.songlist.playedUserQueueHistory).toEqual([]);
    expect(migrated.songlist.currentList).toBeUndefined();
    expect(migrated.playerState.isShuffleActive).toBeUndefined();
  });

  it("migrates legacy IDB source ids and user queue position", () => {
    const song = makeSong("song-1");
    const migrated = migrateSonglistFromIdb({
      contextQueue: {
        songs: [song],
        currentIndex: 0,
        sourceId: { albumId: "album-1" },
        sourceName: "Album",
      },
      userQueue: { songs: [makeSong("queued-1")] },
      userQueuePosition: 1,
    });

    expect(migrated.contextQueue.sourceId).toEqual({
      type: "album",
      id: "album-1",
    });
    expect(migrated.isInUserQueue).toBe(true);
    expect(migrated.userQueue.songs).toHaveLength(1);
    expect("userQueuePosition" in migrated).toBe(false);
  });

  it("leaves already-current IDB songlists alone in legacy migration", () => {
    expect(migrateLegacySonglist(initialSonglist)).toBeNull();
  });
});

describe("player persistence partialize", () => {
  it("omits transient player state while preserving persisted settings", () => {
    const settings = createInitialSettings(() => {});
    const state: IPlayerContext = {
      songlist: initialSonglist,
      playerState: {
        ...initialPlayerState,
        isPlaying: true,
        isBuffering: true,
      },
      playerProgress: initialPlayerProgress,
      settings: {
        ...settings,
        lyrics: {
          ...settings.lyrics,
          customServerPassword: "secret",
        },
      },
      remoteControl: initialRemoteControl,
      actions: {} as IPlayerContext["actions"],
    };

    // biome-ignore lint/suspicious/noExplicitAny: partial persisted output is intentionally narrower than full store state
    const partialized = partializePlayerStoreState(state) as any;

    expect(partialized.songlist).toBeUndefined();
    expect(partialized.actions).toBeUndefined();
    expect(partialized.playerState.isPlaying).toBeUndefined();
    expect(partialized.playerState.isBuffering).toBeUndefined();
    expect(partialized.settings.lyrics.customServerPassword).toMatch(/^enc:/);
  });
});

describe("player IDB songlist trimming", () => {
  it("caps large queues and shuffle histories before IDB writes", () => {
    const contextSongs = Array.from({ length: MAX_QUEUE_SIZE + 20 }, (_, i) =>
      makeSong(`context-${i}`),
    );
    const userSongs = Array.from(
      { length: MAX_USER_QUEUE_IDB_SIZE + 10 },
      (_, i) => makeSong(`user-${i}`),
    );
    const songlist: ISongList = {
      ...initialSonglist,
      contextQueue: {
        ...initialSonglist.contextQueue,
        songs: contextSongs,
        currentIndex: 250,
      },
      userQueue: { songs: userSongs },
      originalContextSongs: contextSongs,
      playedUserQueueHistory: userSongs,
      shuffleStartHistory: Array.from(
        { length: MAX_SHUFFLE_START_HISTORY + 5 },
        (_, i) => `song-${i}`,
      ),
    };

    const trimmed = trimSonglistForIdb(songlist);

    expect(trimmed.contextQueue.songs.length).toBeLessThanOrEqual(
      MAX_QUEUE_SIZE,
    );
    expect(trimmed.userQueue.songs).toHaveLength(MAX_USER_QUEUE_IDB_SIZE);
    expect(trimmed.originalContextSongs).toEqual([]);
    expect(trimmed.playedUserQueueHistory).toHaveLength(
      MAX_USER_QUEUE_IDB_SIZE,
    );
    expect(trimmed.shuffleStartHistory).toHaveLength(MAX_SHUFFLE_START_HISTORY);
  });
});
