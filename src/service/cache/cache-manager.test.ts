import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCacheIndexStore } from "@/store/cache-index.store";
import { _resetLibraryDbForTests, libraryDb } from "@/store/library-db";

const cacheStorageMock = {
  clear: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
};

vi.mock("./cache-storage", () => ({
  cacheStorage: cacheStorageMock,
}));

vi.mock("@/api/httpClient", () => ({
  getCoverArtUrl: vi.fn(() => "/cover"),
  getSongStreamUrl: vi.fn(() => "/stream"),
}));

vi.mock("@/service/subsonic", () => ({
  subsonic: {
    lyrics: {
      getStructuredLyrics: vi.fn(),
    },
  },
}));

vi.mock("@/store/cache.store", () => ({
  useCacheStore: {
    getState: () => ({
      settings: {
        assetsQuota: 0,
        lruQuota: 0,
      },
      actions: {
        updateCacheStats: vi.fn(),
      },
    }),
  },
}));

describe("cacheManager", () => {
  beforeEach(async () => {
    cacheStorageMock.clear.mockReset();
    cacheStorageMock.clear.mockResolvedValue(undefined);
    cacheStorageMock.delete.mockReset();
    cacheStorageMock.delete.mockResolvedValue(true);
    cacheStorageMock.get.mockReset();
    cacheStorageMock.put.mockReset();
    cacheStorageMock.put.mockResolvedValue(undefined);
    await _resetLibraryDbForTests();
    useCacheIndexStore.setState({ items: {}, loaded: true });
  });

  it("returns cached cover URL when cover is cached", async () => {
    const blob = new Blob(["cover"], { type: "image/jpeg" });
    cacheStorageMock.get.mockImplementation(async (key: string) => {
      if (key === "cover:cover-1") return blob;
      return null;
    });

    useCacheIndexStore.setState({
      items: {
        "cover:cover-1": {
          id: "cover-1",
          type: "cover",
          source: "explicit",
          coverSize: "700",
          sizeBytes: blob.size,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    const { cacheManager } = await import("./cache-manager");
    const url = await cacheManager.getCachedCoverUrl("cover-1");

    expect(url).toBeTruthy();
  });

  it("returns cached cover URL even when index is empty (blob exists in Cache API)", async () => {
    const blob = new Blob(["cover"], { type: "image/jpeg" });
    cacheStorageMock.get.mockImplementation(async (key: string) => {
      if (key === "cover:cover-2") return blob;
      return null;
    });

    // Simulate startup before loadFromIDB has finished: index is empty.
    useCacheIndexStore.setState({ items: {}, loaded: false });

    const { cacheManager } = await import("./cache-manager");
    const url = await cacheManager.getCachedCoverUrl("cover-2");

    expect(url).toBeTruthy();
  });

  it("replaces smaller cover with larger size", async () => {
    const bigBlob = new Blob(["big-cover"], { type: "image/jpeg" });

    cacheStorageMock.get.mockResolvedValue(null);

    useCacheIndexStore.setState({
      items: {
        "cover:cover-1": {
          id: "cover-1",
          type: "cover",
          source: "explicit",
          coverSize: "300",
          sizeBytes: 5,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(bigBlob),
    } as Response);

    const { cacheManager } = await import("./cache-manager");
    await cacheManager.cacheCover("cover-1", "700");

    expect(cacheStorageMock.delete).toHaveBeenCalledWith("cover:cover-1");
    expect(cacheStorageMock.put).toHaveBeenCalledWith(
      "cover:cover-1",
      bigBlob,
      "image/jpeg",
    );

    const meta = await libraryDb.cacheMeta.get("cover:cover-1");
    expect(meta).not.toBeUndefined();
    expect(meta?.coverSize).toBe("700");
    expect(meta?.sizeBytes).toBe(bigBlob.size);

    vi.restoreAllMocks();
  });

  it("clearAllCaches also clears prefetched lyrics rows", async () => {
    await libraryDb.lyrics.put({
      songId: "song-1",
      content: "[]",
      cachedAt: 1,
      lastAccessedAt: 1,
    });

    const { cacheManager } = await import("./cache-manager");
    await cacheManager.clearAllCaches();

    expect(await libraryDb.lyrics.count()).toBe(0);
    expect(cacheStorageMock.clear).toHaveBeenCalled();
  });

  it("clearAssets leaves lyrics rows intact", async () => {
    await libraryDb.lyrics.put({
      songId: "song-1",
      content: "[]",
      cachedAt: 1,
      lastAccessedAt: 1,
    });

    useCacheIndexStore.setState({
      items: {
        "cover:cover-1": {
          id: "cover-1",
          type: "cover",
          source: "explicit",
          sizeBytes: 10,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    const { cacheManager } = await import("./cache-manager");
    await cacheManager.clearAssets();

    expect(await libraryDb.lyrics.count()).toBe(1);
    expect(useCacheIndexStore.getState().items).toEqual({});
  });

  it("evictItem removes the row from libraryDb.cacheMeta", async () => {
    await libraryDb.cacheMeta.put({
      key: "audio:song-1",
      id: "song-1",
      type: "audio",
      source: "explicit",
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    });

    useCacheIndexStore.setState({
      items: {
        "audio:song-1": {
          id: "song-1",
          type: "audio",
          source: "explicit",
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    const { cacheManager } = await import("./cache-manager");
    await cacheManager.evictItem("audio:song-1");

    expect(await libraryDb.cacheMeta.get("audio:song-1")).toBeUndefined();
  });

  it("clearAudioBySource removes matching rows from libraryDb.cacheMeta", async () => {
    await libraryDb.cacheMeta.bulkPut([
      {
        key: "audio:song-1",
        id: "song-1",
        type: "audio",
        source: "explicit",
        sizeBytes: 100,
        cachedAt: 1,
        lastAccessedAt: 1,
      },
      {
        key: "audio:song-2",
        id: "song-2",
        type: "audio",
        source: "lru",
        sizeBytes: 200,
        cachedAt: 1,
        lastAccessedAt: 1,
      },
    ]);

    useCacheIndexStore.setState({
      items: {
        "audio:song-1": {
          id: "song-1",
          type: "audio",
          source: "explicit",
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
        "audio:song-2": {
          id: "song-2",
          type: "audio",
          source: "lru",
          sizeBytes: 200,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    const { cacheManager } = await import("./cache-manager");
    await cacheManager.clearAudioBySource("explicit");

    expect(await libraryDb.cacheMeta.get("audio:song-1")).toBeUndefined();
    expect(await libraryDb.cacheMeta.get("audio:song-2")).not.toBeUndefined();
  });

  it("self-heal for audio writes a synthetic row to libraryDb.cacheMeta when missing", async () => {
    const blob = new Blob(["audio"], { type: "audio/mpeg" });
    cacheStorageMock.get.mockImplementation(async (key: string) => {
      if (key === "audio:song-x") return blob;
      return null;
    });

    useCacheIndexStore.setState({ items: {}, loaded: false });

    const { cacheManager } = await import("./cache-manager");
    const url = await cacheManager.getCachedAudioUrl("song-x");

    expect(url).toBeTruthy();
    const meta = await libraryDb.cacheMeta.get("audio:song-x");
    expect(meta).not.toBeUndefined();
    expect(meta?.type).toBe("audio");
    expect(meta?.source).toBe("explicit");
  });
});
