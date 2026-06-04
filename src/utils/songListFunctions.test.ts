import { describe, expect, it } from "vitest";
import {
  addNextSongList,
  getMaxShuffleHistory,
  getMaxShuffleStartHistory,
  pickRandomStartIndex,
  pushToHistory,
  shuffleSongList,
  shuffleWithGapAvoidance,
} from "./songListFunctions";

describe("shuffleSongList", () => {
  const list = [1, 2, 3, 4, 5];

  it("preserves all elements", () => {
    const result = shuffleSongList(list, 2);
    expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("places the indexed item first when not random", () => {
    const result = shuffleSongList(list, 2);
    expect(result[0]).toBe(3);
  });

  it("does not place indexed item first when isRandom=true", () => {
    for (let i = 0; i < 20; i++) {
      const result = shuffleSongList(list, 2, true);
      expect(result).toHaveLength(5);
      expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it("does not mutate the original list", () => {
    const original = [...list];
    shuffleSongList(list, 0);
    expect(list).toEqual(original);
  });

  it("handles single-element list", () => {
    const result = shuffleSongList([42], 0);
    expect(result).toEqual([42]);
  });
});

describe("getMaxShuffleHistory", () => {
  it("returns lower bound for small queues", () => {
    expect(getMaxShuffleHistory(10)).toBe(20);
    expect(getMaxShuffleHistory(0)).toBe(20);
    expect(getMaxShuffleHistory(1)).toBe(20);
  });

  it("returns half of queue length for medium queues", () => {
    expect(getMaxShuffleHistory(100)).toBe(50);
    expect(getMaxShuffleHistory(200)).toBe(100);
  });

  it("returns upper bound for large queues", () => {
    expect(getMaxShuffleHistory(500)).toBe(200);
    expect(getMaxShuffleHistory(1000)).toBe(200);
  });
});

describe("shuffleWithGapAvoidance", () => {
  it("places fresh songs before recent songs", () => {
    const songs = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const history = ["a", "c"];
    const result = shuffleWithGapAvoidance(songs, history);

    const freshIds = result
      .slice(0, 2)
      .map((s) => s.id)
      .sort();
    const recentIds = result
      .slice(2)
      .map((s) => s.id)
      .sort();
    expect(freshIds).toEqual(["b", "d"]);
    expect(recentIds).toEqual(["a", "c"]);
  });

  it("returns all songs even if all are in history", () => {
    const songs = [{ id: "a" }, { id: "b" }];
    const history = ["a", "b"];
    const result = shuffleWithGapAvoidance(songs, history);
    expect(result.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("returns all songs when none are in history", () => {
    const songs = [{ id: "a" }, { id: "b" }];
    const result = shuffleWithGapAvoidance(songs, []);
    expect(result.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("sorts recent songs by history recency (oldest first)", () => {
    const songs = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const history = ["c", "a", "b"];
    const result = shuffleWithGapAvoidance(songs, history);
    const recentPart = result.slice(0);
    const recentIds = recentPart.filter((s) => history.includes(s.id));
    expect(recentIds.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("handles empty song list", () => {
    expect(shuffleWithGapAvoidance([], ["a"])).toEqual([]);
  });

  it("handles empty history", () => {
    const songs = [{ id: "a" }, { id: "b" }];
    const result = shuffleWithGapAvoidance(songs, []);
    expect(result).toHaveLength(2);
  });
});

describe("addNextSongList", () => {
  it("inserts new list after the index", () => {
    expect(addNextSongList(1, [1, 2, 3], [10, 20])).toEqual([1, 2, 10, 20, 3]);
  });

  it("inserts at end when index is last element", () => {
    expect(addNextSongList(2, [1, 2, 3], [10])).toEqual([1, 2, 3, 10]);
  });

  it("inserts at beginning when index is 0", () => {
    expect(addNextSongList(0, [1, 2, 3], [10])).toEqual([1, 10, 2, 3]);
  });

  it("handles empty new list", () => {
    expect(addNextSongList(1, [1, 2, 3], [])).toEqual([1, 2, 3]);
  });

  it("handles empty current list", () => {
    expect(addNextSongList(0, [], [10, 20])).toEqual([10, 20]);
  });
});

describe("getMaxShuffleStartHistory", () => {
  it("returns lower bound for small queues", () => {
    expect(getMaxShuffleStartHistory(10)).toBe(10);
    expect(getMaxShuffleStartHistory(0)).toBe(10);
    expect(getMaxShuffleStartHistory(1)).toBe(10);
  });

  it("returns quarter of queue length for medium queues", () => {
    expect(getMaxShuffleStartHistory(100)).toBe(25);
    expect(getMaxShuffleStartHistory(80)).toBe(20);
  });

  it("returns upper bound for large queues", () => {
    expect(getMaxShuffleStartHistory(300)).toBe(50);
    expect(getMaxShuffleStartHistory(1000)).toBe(50);
  });
});

describe("pickRandomStartIndex", () => {
  const songIds = ["s0", "s1", "s2", "s3", "s4"];
  const getId = (i: number) => songIds[i];

  it("returns 0 for empty list", () => {
    expect(pickRandomStartIndex(0, [], getId)).toBe(0);
  });

  it("returns a valid index within range", () => {
    for (let i = 0; i < 50; i++) {
      const idx = pickRandomStartIndex(songIds.length, [], getId);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(songIds.length);
    }
  });

  it("avoids songs in start history when fresh options exist", () => {
    const history = ["s0", "s1", "s2"];
    for (let i = 0; i < 50; i++) {
      const idx = pickRandomStartIndex(songIds.length, history, getId);
      expect(idx).toBeGreaterThanOrEqual(3);
    }
  });

  it("falls back to any index when all songs are in history", () => {
    const history = [...songIds];
    for (let i = 0; i < 50; i++) {
      const idx = pickRandomStartIndex(songIds.length, history, getId);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(songIds.length);
    }
  });

  it("returns a single valid option deterministically", () => {
    const history = ["s0", "s1", "s2", "s3"];
    const idx = pickRandomStartIndex(songIds.length, history, getId);
    expect(idx).toBe(4);
  });

  it("handles empty history", () => {
    for (let i = 0; i < 50; i++) {
      const idx = pickRandomStartIndex(songIds.length, [], getId);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(songIds.length);
    }
  });
});

describe("pushToHistory", () => {
  it("appends id to empty history", () => {
    expect(pushToHistory([], "a", 3)).toEqual(["a"]);
  });

  it("deduplicates and moves to end", () => {
    expect(pushToHistory(["a", "b", "c"], "a", 3)).toEqual(["b", "c", "a"]);
  });

  it("trims to max length", () => {
    expect(pushToHistory(["a", "b", "c"], "d", 3)).toEqual(["b", "c", "d"]);
  });

  it("does not trim when under max", () => {
    expect(pushToHistory(["a", "b"], "c", 5)).toEqual(["a", "b", "c"]);
  });
});
