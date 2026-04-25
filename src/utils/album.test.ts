import { describe, expect, it } from "vitest";
import { sortRecentAlbums } from "./album";
import type { Albums } from "@/types/responses/album";

function makeAlbum(year: number | undefined): Albums {
  return { year } as Albums;
}

describe("sortRecentAlbums", () => {
  it("sorts albums by year descending", () => {
    const albums = [makeAlbum(2020), makeAlbum(2024), makeAlbum(2022)];
    const result = sortRecentAlbums(albums);
    expect(result.map((a) => a.year)).toEqual([2024, 2022, 2020]);
  });

  it("places albums without year at the end", () => {
    const albums = [
      makeAlbum(undefined),
      makeAlbum(2024),
      makeAlbum(undefined),
    ];
    const result = sortRecentAlbums(albums);
    expect(result[0].year).toBe(2024);
    expect(result[1].year).toBeUndefined();
    expect(result[2].year).toBeUndefined();
  });

  it("handles empty list", () => {
    expect(sortRecentAlbums([])).toEqual([]);
  });

  it("sorts in place (mutates the array)", () => {
    const albums = [makeAlbum(2020), makeAlbum(2024)];
    const result = sortRecentAlbums(albums);
    expect(result).toBe(albums);
    expect(result[0].year).toBe(2024);
  });
});
