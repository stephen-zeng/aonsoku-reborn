import { describe, expect, it } from "vitest";
import type { IContextQueue, ISongList } from "@/types/playerContext";
import { LoopState } from "@/types/playerContext";
import type { ISong } from "@/types/responses/song";
import {
  applyShuffleOff,
  applyShuffleOn,
  applyStarToAllLists,
  buildContextQueueSongs,
  clearSonglistState,
  dedupAgainstExisting,
  emptyContextQueue,
  findSongTier,
  getCurrentSong,
  getEffectiveIndex,
  getEffectiveQueue,
  hasNextEffectiveSong,
  hasAnySongs,
  hasPrevEffectiveSong,
  initSonglistState,
  isPlayingOneSong,
  normalizeSourceId,
  rebuildContextQueueForLoopState,
  reshuffleContextForWrap,
  resetPlaybackState,
  trimQueueToWindow,
} from "./queue-utils";

function makeSong(id: string, duration = 180): ISong {
  return { id, duration } as ISong;
}

function makeSonglist(overrides?: Partial<ISongList>): ISongList {
  return {
    ...initSonglistState(),
    ...overrides,
  };
}

function makeContextQueue(
  songs: ISong[],
  currentIndex = 0,
  overrides?: Partial<IContextQueue>,
): IContextQueue {
  return {
    ...emptyContextQueue(),
    songs,
    currentIndex,
    ...overrides,
  };
}

describe("getCurrentSong", () => {
  it("returns null for an empty songlist", () => {
    const songlist = makeSonglist();
    expect(getCurrentSong(songlist)).toBeNull();
  });

  it("returns the context queue song at currentIndex", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 1),
      isInUserQueue: false,
    });
    expect(getCurrentSong(songlist)?.id).toBe("b");
  });

  it("returns the first user queue song when isInUserQueue is true", () => {
    const songs = [makeSong("a"), makeSong("b")];
    const userSongs = [makeSong("u1"), makeSong("u2")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 0),
      userQueue: { songs: userSongs },
      isInUserQueue: true,
    });
    expect(getCurrentSong(songlist)?.id).toBe("u1");
  });

  it("falls back to context song when isInUserQueue but user queue is empty", () => {
    const songs = [makeSong("a")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 0),
      userQueue: { songs: [] },
      isInUserQueue: true,
    });
    expect(getCurrentSong(songlist)?.id).toBe("a");
  });

  it("returns context song when isInUserQueue is false", () => {
    const songs = [makeSong("a"), makeSong("b")];
    const userSongs = [makeSong("u1")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 1),
      userQueue: { songs: userSongs },
      isInUserQueue: false,
    });
    expect(getCurrentSong(songlist)?.id).toBe("b");
  });
});

describe("getEffectiveQueue", () => {
  it("returns context songs only when no user queue", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 1),
      userQueue: { songs: [] },
    });
    const result = getEffectiveQueue(songlist);
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("interleaves user queue after played context songs", () => {
    const contextSongs = [makeSong("a"), makeSong("b"), makeSong("c")];
    const userSongs = [makeSong("u1"), makeSong("u2")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(contextSongs, 0),
      userQueue: { songs: userSongs },
      isInUserQueue: false,
    });
    const result = getEffectiveQueue(songlist);
    expect(result.map((s) => s.id)).toEqual(["a", "u1", "u2", "b", "c"]);
  });
});

describe("getEffectiveIndex", () => {
  it("returns context index when not in user queue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 2),
      isInUserQueue: false,
    });
    expect(getEffectiveIndex(songlist)).toBe(2);
  });

  it("returns context index + 1 when in user queue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 0),
      userQueue: { songs: [makeSong("u1")] },
      isInUserQueue: true,
    });
    expect(getEffectiveIndex(songlist)).toBe(1);
  });
});

describe("hasNextEffectiveSong", () => {
  it("returns true when there are more context songs", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(
        [makeSong("a"), makeSong("b"), makeSong("c")],
        0,
      ),
      isInUserQueue: false,
    });
    expect(hasNextEffectiveSong(songlist, LoopState.Off)).toBe(true);
  });

  it("returns false at last context song with loop off and no user queue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 1),
      userQueue: { songs: [] },
      isInUserQueue: false,
    });
    expect(hasNextEffectiveSong(songlist, LoopState.Off)).toBe(false);
  });

  it("returns true at last context song with loop all", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 1),
      userQueue: { songs: [] },
      isInUserQueue: false,
    });
    expect(hasNextEffectiveSong(songlist, LoopState.All)).toBe(true);
  });

  it("returns true when user queue has songs even at last context song", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 1),
      userQueue: { songs: [makeSong("u1")] },
      isInUserQueue: false,
    });
    expect(hasNextEffectiveSong(songlist, LoopState.Off)).toBe(true);
  });

  it("returns true when in user queue with remaining user songs", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 1),
      userQueue: { songs: [makeSong("u1"), makeSong("u2")] },
      isInUserQueue: true,
    });
    expect(hasNextEffectiveSong(songlist, LoopState.Off)).toBe(true);
  });

  it("returns true when in user queue at last user song but loop all", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 1),
      userQueue: { songs: [makeSong("u1")] },
      isInUserQueue: true,
    });
    expect(hasNextEffectiveSong(songlist, LoopState.All)).toBe(true);
  });

  it("returns false when in user queue at last song with loop off", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 1),
      userQueue: { songs: [makeSong("u1")] },
      isInUserQueue: true,
    });
    expect(hasNextEffectiveSong(songlist, LoopState.Off)).toBe(false);
  });
});

describe("hasPrevEffectiveSong", () => {
  it("returns false at start of context queue with no history", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 0),
      playedUserQueueHistory: [],
      isInUserQueue: false,
    });
    expect(hasPrevEffectiveSong(songlist)).toBe(false);
  });

  it("returns true when there is playedUserQueueHistory", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      playedUserQueueHistory: [makeSong("prev1")],
      isInUserQueue: false,
    });
    expect(hasPrevEffectiveSong(songlist)).toBe(true);
  });

  it("returns true when isInUserQueue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      isInUserQueue: true,
    });
    expect(hasPrevEffectiveSong(songlist)).toBe(true);
  });

  it("returns true when context index > 0", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(
        [makeSong("a"), makeSong("b"), makeSong("c")],
        2,
      ),
      isInUserQueue: false,
    });
    expect(hasPrevEffectiveSong(songlist)).toBe(true);
  });
});

describe("isPlayingOneSong", () => {
  it("returns true when context queue has one song and no user queue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      userQueue: { songs: [] },
    });
    expect(isPlayingOneSong(songlist)).toBe(true);
  });

  it("returns false when multiple context songs", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 0),
      userQueue: { songs: [] },
    });
    expect(isPlayingOneSong(songlist)).toBe(false);
  });

  it("returns false when one context song plus user queue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      userQueue: { songs: [makeSong("u1")] },
    });
    expect(isPlayingOneSong(songlist)).toBe(false);
  });

  it("returns true when both queues are empty", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([], 0),
      userQueue: { songs: [] },
    });
    expect(isPlayingOneSong(songlist)).toBe(true);
  });
});

describe("findSongTier", () => {
  it("returns 'user' when song is in user queue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      userQueue: { songs: [makeSong("u1")] },
    });
    expect(findSongTier(songlist, "u1")).toBe("user");
  });

  it("returns 'user' when song is in playedUserQueueHistory", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      userQueue: { songs: [] },
      playedUserQueueHistory: [makeSong("u1")],
    });
    expect(findSongTier(songlist, "u1")).toBe("user");
  });

  it("returns 'context' when song is in context queue", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 0),
      userQueue: { songs: [] },
    });
    expect(findSongTier(songlist, "b")).toBe("context");
  });

  it("returns null when song is not found", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      userQueue: { songs: [] },
    });
    expect(findSongTier(songlist, "z")).toBeNull();
  });
});

describe("dedupAgainstExisting", () => {
  it("keeps songs not in existing", () => {
    const incoming = [makeSong("a"), makeSong("b"), makeSong("c")];
    const existing = [makeSong("b")];
    const result = dedupAgainstExisting(incoming, existing);
    expect(result.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("removes duplicates within incoming itself", () => {
    const incoming = [makeSong("a"), makeSong("a"), makeSong("b")];
    const existing: ISong[] = [];
    const result = dedupAgainstExisting(incoming, existing);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("returns all songs when no existing and no duplicates", () => {
    const incoming = [makeSong("a"), makeSong("b")];
    const result = dedupAgainstExisting(incoming, []);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("returns empty array when all incoming already exist", () => {
    const incoming = [makeSong("a"), makeSong("b")];
    const existing = [makeSong("a"), makeSong("b")];
    const result = dedupAgainstExisting(incoming, existing);
    expect(result).toEqual([]);
  });
});

describe("emptyContextQueue", () => {
  it("returns a default context queue", () => {
    const q = emptyContextQueue();
    expect(q.songs).toEqual([]);
    expect(q.currentIndex).toBe(0);
    expect(q.sourceId).toBeNull();
    expect(q.sourceName).toBeNull();
  });

  it("overrides with provided values", () => {
    const sourceId = { type: "album" as const, id: "album-1" };
    const q = emptyContextQueue({
      songs: [makeSong("a")],
      currentIndex: 0,
      sourceId,
      sourceName: "Test Album",
    });
    expect(q.songs).toHaveLength(1);
    expect(q.sourceId).toEqual(sourceId);
    expect(q.sourceName).toBe("Test Album");
  });
});

describe("initSonglistState", () => {
  it("returns a valid initial songlist", () => {
    const state = initSonglistState();
    expect(state.contextQueue.songs).toEqual([]);
    expect(state.contextQueue.currentIndex).toBe(0);
    expect(state.userQueue.songs).toEqual([]);
    expect(state.originalContextSongs).toEqual([]);
    expect(state.currentSong).toBeNull();
    expect(state.isShuffleActive).toBe(false);
    expect(state.isInUserQueue).toBe(false);
    expect(state.playedUserQueueHistory).toEqual([]);
    expect(state.shuffleHistory).toEqual([]);
    expect(state.shuffleStartHistory).toEqual([]);
  });
});

describe("clearSonglistState", () => {
  it("resets all songlist fields to initial values", () => {
    const state = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 1, {
        sourceId: { type: "album", id: "x" },
        sourceName: "Album X",
      }),
      userQueue: { songs: [makeSong("u1")] },
      currentSong: makeSong("a"),
      isShuffleActive: true,
      isInUserQueue: true,
      originalContextSongs: [makeSong("a"), makeSong("b")],
      playedUserQueueHistory: [makeSong("old")],
      shuffleHistory: ["a", "b"],
      shuffleStartHistory: ["a"],
    });
    clearSonglistState(state as ISongList & { currentSong: ISong });
    expect(state.contextQueue.songs).toEqual([]);
    expect(state.contextQueue.currentIndex).toBe(0);
    expect(state.userQueue.songs).toEqual([]);
    expect(state.currentSong).toBeNull();
    expect(state.isShuffleActive).toBe(false);
    expect(state.isInUserQueue).toBe(false);
    expect(state.originalContextSongs).toEqual([]);
  });
});

describe("applyShuffleOn", () => {
  it("sets isShuffleActive to true and saves original context songs", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c"), makeSong("d")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 1),
      userQueue: { songs: [] },
      originalContextSongs: [],
    });
    applyShuffleOn(songlist as ISongList & { originalContextSongs: ISong[] });
    expect(songlist.isShuffleActive).toBe(true);
    expect(songlist.originalContextSongs).toEqual(songs);
  });

  it("moves current song to the first position when starting from index", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c"), makeSong("d")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 1),
      userQueue: { songs: [] },
    });
    applyShuffleOn(songlist as ISongList);
    expect(songlist.contextQueue.songs[0]).toEqual(songs[1]);
    expect(songlist.contextQueue.currentIndex).toBe(0);
  });

  it("shuffles upcoming songs after current index", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c"), makeSong("d")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([...songs], 1),
      userQueue: { songs: [] },
    });
    applyShuffleOn(songlist as ISongList);
    expect(songlist.contextQueue.songs).toHaveLength(3);
    expect(songlist.contextQueue.currentIndex).toBe(0);
    expect(songlist.contextQueue.songs[0]).toEqual(songs[1]);
  });

  it("does nothing for single-song queue", () => {
    const songs = [makeSong("a")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 0),
      userQueue: { songs: [] },
    });
    applyShuffleOn(songlist as ISongList);
    expect(songlist.isShuffleActive).toBe(false);
  });

  it("can rebuild from the source queue when at the last playback song", () => {
    const songs = [makeSong("a"), makeSong("b")];
    const songlist = makeSonglist({
      sourceQueue: makeContextQueue(songs, 1),
      contextQueue: makeContextQueue(songs, 1),
      userQueue: { songs: [] },
    });
    applyShuffleOn(songlist as ISongList);
    expect(songlist.isShuffleActive).toBe(true);
    expect(songlist.contextQueue.songs.map((song) => song.id)).toEqual(["b"]);
  });

  it("shuffles user queue songs when present", () => {
    const songs = [makeSong("a"), makeSong("b")];
    const userSongs = [makeSong("u1"), makeSong("u2"), makeSong("u3")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 0),
      userQueue: { songs: [...userSongs] },
    });
    applyShuffleOn(songlist as ISongList);
    expect(songlist.isShuffleActive).toBe(true);
    expect(
      songlist.userQueue.songs
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => s.id),
    ).toEqual(["u1", "u2", "u3"]);
  });
});

describe("buildContextQueueSongs", () => {
  const reverseShuffle = (items: ISong[]) => [...items].reverse();

  it("builds a non-looping queue from the current song", () => {
    const songs = ["a", "b", "c", "d", "e", "f"].map((id) => makeSong(id));
    const result = buildContextQueueSongs(songs, 2, LoopState.Off, false);
    expect(result.map((song) => song.id)).toEqual(["c", "d", "e", "f"]);
  });

  it("shuffles only remaining songs for non-looping shuffle", () => {
    const songs = ["a", "b", "c", "d", "e", "f"].map((id) => makeSong(id));
    const result = buildContextQueueSongs(
      songs,
      2,
      LoopState.Off,
      true,
      reverseShuffle,
    );
    expect(result.map((song) => song.id)).toEqual(["c", "f", "e", "d"]);
  });

  it("builds a full rotated queue for looping playback", () => {
    const songs = ["a", "b", "c", "d", "e", "f"].map((id) => makeSong(id));
    const result = buildContextQueueSongs(songs, 2, LoopState.All, false);
    expect(result.map((song) => song.id)).toEqual([
      "c",
      "d",
      "e",
      "f",
      "a",
      "b",
    ]);
  });

  it("shuffles all remaining songs for looping shuffle", () => {
    const songs = ["a", "b", "c", "d", "e", "f"].map((id) => makeSong(id));
    const result = buildContextQueueSongs(
      songs,
      2,
      LoopState.All,
      true,
      reverseShuffle,
    );
    expect(result.map((song) => song.id)).toEqual([
      "c",
      "b",
      "a",
      "f",
      "e",
      "d",
    ]);
  });
});

describe("rebuildContextQueueForLoopState", () => {
  it("extends a non-looping queue when repeat all is enabled", () => {
    const original = ["a", "b", "c", "d", "e", "f"].map((id) => makeSong(id));
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(original.slice(2), 0),
      currentSong: original[2],
      originalContextSongs: [...original],
    });

    rebuildContextQueueForLoopState(songlist, LoopState.All);

    expect(songlist.contextQueue.songs.map((song) => song.id)).toEqual([
      "c",
      "d",
      "e",
      "f",
      "a",
      "b",
    ]);
    expect(songlist.contextQueue.currentIndex).toBe(0);
  });

  it("truncates a looping queue when repeat is disabled", () => {
    const original = ["a", "b", "c", "d", "e", "f"].map((id) => makeSong(id));
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(
        [
          original[2],
          original[3],
          original[4],
          original[5],
          original[0],
          original[1],
        ],
        0,
      ),
      currentSong: original[2],
      originalContextSongs: [...original],
    });

    rebuildContextQueueForLoopState(songlist, LoopState.Off);

    expect(songlist.contextQueue.songs.map((song) => song.id)).toEqual([
      "c",
      "d",
      "e",
      "f",
    ]);
    expect(songlist.contextQueue.currentIndex).toBe(0);
  });
});

describe("applyShuffleOff", () => {
  it("restores original context songs and finds current song in original", () => {
    const original = [
      makeSong("a"),
      makeSong("b"),
      makeSong("c"),
      makeSong("d"),
    ];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(
        [makeSong("a"), makeSong("d"), makeSong("b"), makeSong("c")],
        2,
      ),
      originalContextSongs: [...original],
      isShuffleActive: true,
      isInUserQueue: false,
    });
    songlist.currentSong = songlist.contextQueue.songs[2];

    applyShuffleOff(songlist as ISongList);
    expect(songlist.contextQueue.songs).toEqual(original.slice(1));
    expect(songlist.contextQueue.currentIndex).toBe(0);
    expect(songlist.isShuffleActive).toBe(false);
  });

  it("resets to index 0 when current song not found and not in user queue", () => {
    const original = [makeSong("a"), makeSong("b"), makeSong("c")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("x"), makeSong("y")], 0),
      originalContextSongs: [...original],
      isShuffleActive: true,
      isInUserQueue: false,
    });
    songlist.currentSong = makeSong("z");

    applyShuffleOff(songlist as ISongList);
    expect(songlist.contextQueue.currentIndex).toBe(0);
    expect(songlist.contextQueue.songs).toEqual(original);
  });

  it("restores user queue songs from originalUserSongs", () => {
    const originalUser = [makeSong("u1"), makeSong("u2")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 0),
      originalContextSongs: [makeSong("a"), makeSong("b")],
      originalUserSongs: [...originalUser],
      isShuffleActive: true,
      isInUserQueue: false,
    });

    applyShuffleOff(songlist as ISongList);
    expect(songlist.userQueue.songs).toEqual(originalUser);
    expect(songlist.originalUserSongs).toBeUndefined();
  });

  it("clears shuffle-related state", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a"), makeSong("b")], 0),
      originalContextSongs: [makeSong("a"), makeSong("b")],
      isShuffleActive: true,
      shuffleHistory: ["a", "b"],
      playedUserQueueHistory: [makeSong("u1")],
    });

    applyShuffleOff(songlist as ISongList);
    expect(songlist.isShuffleActive).toBe(false);
    expect(songlist.shuffleHistory).toEqual([]);
    expect(songlist.playedUserQueueHistory).toEqual([]);
  });
});

describe("trimQueueToWindow", () => {
  it("returns unchanged queue when under max size", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c")];
    const result = trimQueueToWindow(songs, 1);
    expect(result.songs).toEqual(songs);
    expect(result.currentIndex).toBe(1);
  });

  it("trims to window centered on currentIndex for large queues", () => {
    const songs = Array.from({ length: 600 }, (_, i) => makeSong(`s${i}`));
    const result = trimQueueToWindow(songs, 300);
    expect(result.songs.length).toBeLessThanOrEqual(500);
    expect(result.currentIndex).toBeLessThanOrEqual(300);
    expect(result.currentIndex).toBeGreaterThanOrEqual(0);
  });

  it("handles empty queue", () => {
    const result = trimQueueToWindow([], 0);
    expect(result.songs).toEqual([]);
    expect(result.currentIndex).toBe(0);
  });

  it("handles index at start of large queue", () => {
    const songs = Array.from({ length: 600 }, (_, i) => makeSong(`s${i}`));
    const result = trimQueueToWindow(songs, 0);
    expect(result.songs[0]).toEqual(songs[0]);
    expect(result.currentIndex).toBe(0);
  });

  it("handles index at end of large queue", () => {
    const songs = Array.from({ length: 600 }, (_, i) => makeSong(`s${i}`));
    const result = trimQueueToWindow(songs, 599);
    expect(result.songs[result.songs.length - 1]).toEqual(songs[599]);
  });
});

describe("normalizeSourceId", () => {
  it("returns null for undefined", () => {
    expect(normalizeSourceId(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(normalizeSourceId(null)).toBeNull();
  });

  it("normalizes album source id", () => {
    expect(normalizeSourceId({ albumId: "abc" })).toEqual({
      type: "album",
      id: "abc",
    });
  });

  it("normalizes playlist source id", () => {
    expect(normalizeSourceId({ playlistId: "xyz" })).toEqual({
      type: "playlist",
      id: "xyz",
    });
  });

  it("passes through valid typed source ids", () => {
    const albumSource = { type: "album" as const, id: "abc" };
    expect(normalizeSourceId(albumSource)).toEqual(albumSource);
  });

  it("passes through radio source id", () => {
    expect(normalizeSourceId({ type: "radio", id: "r1" })).toEqual({
      type: "radio",
      id: "r1",
    });
  });

  it("returns null for unknown type", () => {
    expect(normalizeSourceId({ type: "unknown", id: "x" })).toBeNull();
  });
});

describe("reshuffleContextForWrap", () => {
  it("does nothing when shuffle is not active", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 0),
      isShuffleActive: false,
    });
    const original = [...songlist.contextQueue.songs];
    reshuffleContextForWrap(songlist as ISongList, "a");
    expect(songlist.contextQueue.songs).toEqual(original);
  });

  it("does nothing when queue has only one song", () => {
    const songs = [makeSong("a")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue(songs, 0),
      isShuffleActive: true,
    });
    reshuffleContextForWrap(songlist as ISongList, "a");
    expect(songlist.contextQueue.songs).toHaveLength(1);
    expect(songlist.contextQueue.songs[0].id).toBe("a");
  });

  it("reshuffles upcoming songs keeping first song in place", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c"), makeSong("d")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([...songs], 0),
      isShuffleActive: true,
      shuffleHistory: [],
    });
    reshuffleContextForWrap(songlist as ISongList, "d");
    expect(songlist.contextQueue.songs[0].id).toBe("a");
    expect(songlist.contextQueue.songs).toHaveLength(4);
  });

  it("moves last played song to end of reshuffled", () => {
    const songs = [makeSong("a"), makeSong("b"), makeSong("c"), makeSong("d")];
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([...songs], 0),
      isShuffleActive: true,
      shuffleHistory: [],
    });
    reshuffleContextForWrap(songlist as ISongList, "d");
    const lastSong =
      songlist.contextQueue.songs[songlist.contextQueue.songs.length - 1];
    expect(lastSong.id).toBe("d");
  });
});

describe("resetPlaybackState", () => {
  it("resets playback state to default values", () => {
    const state = {
      playerState: {
        isPlaying: true,
        isBuffering: true,
        hasPrev: true,
        hasNext: true,
        currentDuration: 200,
        loopState: LoopState.All,
      },
      playerProgress: {
        progress: 50,
        bufferedProgress: 80,
      },
      songlist: {
        isShuffleActive: true,
        shuffleHistory: ["a", "b"],
        shuffleStartHistory: ["c"],
      },
    };

    resetPlaybackState(state as Parameters<typeof resetPlaybackState>[0]);

    expect(state.playerState.isPlaying).toBe(false);
    expect(state.playerState.isBuffering).toBe(false);
    expect(state.playerProgress.progress).toBe(0);
    expect(state.playerProgress.bufferedProgress).toBe(0);
    expect(state.playerState.currentDuration).toBe(0);
    expect(state.songlist.isShuffleActive).toBe(false);
    expect(state.songlist.shuffleHistory).toEqual([]);
    expect(state.songlist.shuffleStartHistory).toEqual([]);
    expect(state.playerState.loopState).toBe(LoopState.Off);
    expect(state.playerState.hasPrev).toBe(false);
    expect(state.playerState.hasNext).toBe(false);
  });
});

describe("applyStarToAllLists", () => {
  it("updates starred status on matching context queue song", () => {
    const songA = { ...makeSong("a"), starred: undefined };
    const songB = makeSong("b");
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([songA, songB], 0),
      userQueue: { songs: [] },
    });

    applyStarToAllLists(songlist as ISongList, "a", "2024-01-01");

    expect(songlist.contextQueue.songs[0].starred).toBe("2024-01-01");
    expect(songlist.contextQueue.songs[1].starred).toBeUndefined();
  });

  it("updates starred status on matching user queue song", () => {
    const songU = makeSong("u1");
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      userQueue: { songs: [songU] },
    });

    applyStarToAllLists(songlist as ISongList, "u1", "2024-01-01");

    expect(songlist.userQueue.songs[0].starred).toBe("2024-01-01");
  });

  it("updates currentSong when id matches", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      currentSong: makeSong("a"),
    });
    songlist.currentSong!.starred = undefined;

    applyStarToAllLists(songlist as ISongList, "a", "2024-01-01");

    expect(songlist.currentSong!.starred).toBe("2024-01-01");
  });

  it("unstars when newStarred is undefined", () => {
    const songA = {
      ...makeSong("a"),
      starred: "2024-01-01" as string | undefined,
    };
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([songA], 0),
      userQueue: { songs: [] },
      currentSong: { ...makeSong("a"), starred: "2024-01-01" },
    });

    applyStarToAllLists(songlist as ISongList, "a", undefined);

    expect(songlist.contextQueue.songs[0].starred).toBeUndefined();
  });

  it("does not modify other songs", () => {
    const songA = makeSong("a");
    const songB = makeSong("b");
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([songA, songB], 0),
      userQueue: { songs: [] },
      currentSong: null,
    });

    applyStarToAllLists(songlist as ISongList, "a", "2024-01-01");

    expect(songlist.contextQueue.songs[1].starred).toBeUndefined();
  });
});

describe("LoopState enum", () => {
  it("has Off=0, All=1, One=2", () => {
    expect(LoopState.Off).toBe(0);
    expect(LoopState.All).toBe(1);
    expect(LoopState.One).toBe(2);
  });
});

describe("hasAnySongs", () => {
  it("returns true when context queue has songs", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([makeSong("a")], 0),
      userQueue: { songs: [] },
    });
    expect(hasAnySongs(songlist)).toBe(true);
  });

  it("returns true when only user queue has songs", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([], 0),
      userQueue: { songs: [makeSong("u1")] },
    });
    expect(hasAnySongs(songlist)).toBe(true);
  });

  it("returns false when both queues are empty", () => {
    const songlist = makeSonglist({
      contextQueue: makeContextQueue([], 0),
      userQueue: { songs: [] },
    });
    expect(hasAnySongs(songlist)).toBe(false);
  });
});
