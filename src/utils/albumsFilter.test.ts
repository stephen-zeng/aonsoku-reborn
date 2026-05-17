import { describe, expect, it } from "vitest";
import {
  AlbumsFilters,
  AlbumsSearchParams,
  albumsFilterValues,
  PersistedAlbumListKeys,
  SongsOrderByOptions,
  SortOptions,
  YearSortOptions,
} from "./albumsFilter";

describe("AlbumsSearchParams", () => {
  it("has expected enum values", () => {
    expect(AlbumsSearchParams.MainFilter).toBe("filter");
    expect(AlbumsSearchParams.YearFilter).toBe("yearFilter");
    expect(AlbumsSearchParams.Genre).toBe("genre");
    expect(AlbumsSearchParams.ArtistId).toBe("artistId");
  });
});

describe("PersistedAlbumListKeys", () => {
  it("has expected persisted key values", () => {
    expect(PersistedAlbumListKeys.MainFilter).toBe("albums-list-filter");
    expect(PersistedAlbumListKeys.YearFilter).toBe("albums-list-year");
  });
});

describe("YearSortOptions", () => {
  it("has oldest and newest options", () => {
    expect(YearSortOptions.Oldest).toBe("oldest");
    expect(YearSortOptions.Newest).toBe("newest");
  });
});

describe("AlbumsFilters", () => {
  it("has all expected filter values", () => {
    expect(AlbumsFilters.ByArtist).toBe("alphabeticalByArtist");
    expect(AlbumsFilters.Starred).toBe("starred");
    expect(AlbumsFilters.Random).toBe("random");
    expect(AlbumsFilters.Search).toBe("search");
  });
});

describe("albumsFilterValues", () => {
  it("has an entry for each AlbumsFilters value", () => {
    const filterKeys = Object.values(AlbumsFilters);
    const configKeys = albumsFilterValues.map((v) => v.key);
    expect(configKeys.sort()).toEqual(filterKeys.sort());
  });

  it("each entry has a key and label", () => {
    for (const entry of albumsFilterValues) {
      expect(entry.key).toBeTruthy();
      expect(entry.label).toBeTruthy();
    }
  });
});

describe("SortOptions", () => {
  it("has asc and desc", () => {
    expect(SortOptions.Asc).toBe("asc");
    expect(SortOptions.Desc).toBe("desc");
  });
});

describe("SongsOrderByOptions", () => {
  it("has expected order-by values", () => {
    expect(SongsOrderByOptions.LastAdded).toBe("created");
    expect(SongsOrderByOptions.Artist).toBe("artist");
    expect(SongsOrderByOptions.Title).toBe("title");
    expect(SongsOrderByOptions.Album).toBe("album");
  });
});
