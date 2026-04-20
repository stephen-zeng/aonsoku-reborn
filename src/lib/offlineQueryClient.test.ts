import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetLibraryDbForTests, libraryDb } from "@/store/library-db";
import { idbFirstQueryFn, offlineData } from "./offlineQueryClient";

beforeEach(async () => {
  await _resetLibraryDbForTests();
});

describe("idbFirstQueryFn", () => {
  it("returns IDB data when present and never calls the network", async () => {
    const network = vi.fn(async () => ["network"]);
    const idb = vi.fn(async () => ["idb"]);
    const fn = idbFirstQueryFn(network, idb);

    const result = await fn();

    expect(result).toEqual(["idb"]);
    expect(idb).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
  });

  it("falls back to the network when IDB returns an empty array", async () => {
    const network = vi.fn(async () => ["from-network"]);
    const idb = vi.fn(async () => [] as string[]);
    const fn = idbFirstQueryFn(network, idb);

    const result = await fn();

    expect(result).toEqual(["from-network"]);
    expect(idb).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("can treat an empty IDB result as authoritative when requested", async () => {
    const network = vi.fn(async () => ["from-network"]);
    const idb = vi.fn(async () => [] as string[]);
    const fn = idbFirstQueryFn(network, idb, { acceptEmpty: true });

    const result = await fn();

    expect(result).toEqual([]);
    expect(idb).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
  });

  it("falls back to the network when IDB returns null / undefined", async () => {
    const network = vi.fn(async () => ({ id: "net" }));
    const idb = vi.fn(async () => null as unknown as { id: string });
    const fn = idbFirstQueryFn(network, idb);

    const result = await fn();

    expect(result).toEqual({ id: "net" });
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("falls back to the network when IDB throws", async () => {
    const network = vi.fn(async () => ["net"]);
    const idb = vi.fn(async () => {
      throw new Error("db read blew up");
    });
    const fn = idbFirstQueryFn(network, idb);

    const result = await fn();

    expect(result).toEqual(["net"]);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("goes straight to the network when no offlineFn is provided", async () => {
    const network = vi.fn(async () => ["only-net"]);
    const fn = idbFirstQueryFn(network);

    const result = await fn();

    expect(result).toEqual(["only-net"]);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it("does not branch on navigator.onLine or isOfflineMode", async () => {
    // Whatever the network state, the logic above depends only on the
    // IDB result. Simulate both by calling twice with different wrappers.
    const network = vi.fn(async () => ["net"]);
    const idbWithData = vi.fn(async () => ["idb"]);
    const idbEmpty = vi.fn(async () => [] as string[]);

    expect(await idbFirstQueryFn(network, idbWithData)()).toEqual(["idb"]);
    expect(await idbFirstQueryFn(network, idbEmpty)()).toEqual(["net"]);
  });
});

describe("offlineData", () => {
  it("reads the current Dexie contents for each library table", async () => {
    await libraryDb.artists.put({
      id: "a1",
      name: "A",
      albumCount: 1,
      coverArt: "",
      artistImageUrl: "",
    });
    await libraryDb.genres.put({ value: "rock", songCount: 1, albumCount: 1 });

    const artists = await offlineData.artists();
    const genres = await offlineData.genres();
    const albums = await offlineData.albums();

    expect(artists).toHaveLength(1);
    expect(artists[0].id).toBe("a1");
    expect(genres).toHaveLength(1);
    expect(albums).toHaveLength(0);
  });
});
