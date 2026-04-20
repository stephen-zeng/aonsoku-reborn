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

  it("falls back to another cached cover size when the requested size is missing", async () => {
    const blob = new Blob(["cover"], { type: "image/jpeg" });
    cacheStorageMock.get.mockImplementation(async (key: string) => {
      if (key === "cover:cover-1:700") return blob;
      return null;
    });

    useCacheIndexStore.setState({
      items: {
        "cover:cover-1:700": {
          id: "cover-1",
          type: "cover",
          source: "explicit",
          sizeBytes: blob.size,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    const { cacheManager } = await import("./cache-manager");
    const url = await cacheManager.getCachedCoverUrl("cover-1", "300");

    expect(url).toBeTruthy();
    expect(cacheStorageMock.put).toHaveBeenCalledWith(
      "cover:cover-1:300",
      blob,
      "image/jpeg",
    );
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
        "cover:cover-1:300": {
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
