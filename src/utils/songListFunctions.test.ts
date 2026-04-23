import { describe, expect, it } from "vitest";
import {
  addNextSongList,
  MAX_SHUFFLE_HISTORY,
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

describe("MAX_SHUFFLE_HISTORY", () => {
  it("is 50", () => {
    expect(MAX_SHUFFLE_HISTORY).toBe(50);
  });
});

describe("shuffleWithGapAvoidance", () => {
  it("places fresh songs before recent songs", () => {
    const songs = [
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ];
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
    const recentIds = recentPart.filter(
      (s) => history.includes(s.id),
    );
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
    expect(addNextSongList(1, [1, 2, 3], [10, 20])).toEqual([
      1,
      2,
      10,
      20,
      3,
    ]);
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