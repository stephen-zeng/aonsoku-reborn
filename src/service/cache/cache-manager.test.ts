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
  getDownloadUrl: vi.fn(() => "/download"),
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
        downloadQuality: "original",
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
    useCacheIndexStore.setState({ items: {}, loaded: true });

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
});
