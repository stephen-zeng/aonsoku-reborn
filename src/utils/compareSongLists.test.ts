import { describe, expect, it } from "vitest";
import { areSongListsEqual } from "./compareSongLists";
import type { ISong } from "@/types/responses/song";

function makeSong(id: string): ISong {
  return { id } as ISong;
}

describe("areSongListsEqual", () => {
  it("returns true for identical lists", () => {
    const list1 = [makeSong("a"), makeSong("b")];
    const list2 = [makeSong("a"), makeSong("b")];
    expect(areSongListsEqual(list1, list2)).toBe(true);
  });

  it("returns false for different length lists", () => {
    const list1 = [makeSong("a")];
    const list2 = [makeSong("a"), makeSong("b")];
    expect(areSongListsEqual(list1, list2)).toBe(false);
  });

  it("returns false when songs differ", () => {
    const list1 = [makeSong("a"), makeSong("b")];
    const list2 = [makeSong("a"), makeSong("c")];
    expect(areSongListsEqual(list1, list2)).toBe(false);
  });

  it("returns true for two empty lists", () => {
    expect(areSongListsEqual([], [])).toBe(true);
  });

  it("returns false when order differs", () => {
    const list1 = [makeSong("a"), makeSong("b")];
    const list2 = [makeSong("b"), makeSong("a")];
    expect(areSongListsEqual(list1, list2)).toBe(false);
  });
});
