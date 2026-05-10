import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCacheIndexStore } from "@/store/cache-index.store";
import { useCacheStore } from "@/store/cache.store";
import { _resetLibraryDbForTests, libraryDb } from "@/store/library-db";

const cacheSmartSong = vi.fn();
const cacheStorageDelete = vi.fn().mockResolvedValue(undefined);
const persistCacheMeta = vi.fn().mockResolvedValue(undefined);
const deleteCacheMeta = vi.fn().mockResolvedValue(undefined);

vi.mock("./cache-manager", () => ({
  cacheManager: {
    cacheSmartSong,
  },
}));

vi.mock("./cache-storage", () => ({
  cacheStorage: {
    delete: cacheStorageDelete,
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    has: vi.fn().mockResolvedValue(false),
    keys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("./persist-meta", () => ({
  persistCacheMeta,
  deleteCacheMeta,
}));

vi.mock("@/service/subsonic", () => ({
  subsonic: {
    playlists: {
      getOne: vi.fn(),
    },
  },
}));

vi.mock("@/app/hooks/use-network-status", () => ({
  getNetworkStatus: vi.fn(() => ({ isOnline: true })),
}));

function makeSong(
  id: string,
  overrides: Partial<Awaited<ReturnType<typeof libraryDb.songs.get>>> = {},
) {
  return {
    id,
    parent: "album_1",
    isDir: false,
    title: `Song ${id}`,
    album: "Album 1",
    artist: "Artist 1",
    track: 1,
    year: 2024,
    coverArt: "",
    size: 1,
    contentType: "audio/mpeg",
    suffix: "mp3",
    duration: 180,
    bitRate: 320,
    path: `path/${id}`,
    discNumber: 1,
    created: "2024-01-01T00:00:00.000Z",
    albumId: "album_1",
    artistId: "artist_1",
    type: "music",
    isVideo: false,
    bpm: 0,
    comment: "",
    sortName: `Song ${id}`,
    mediaType: "song",
    musicBrainzId: "",
    genres: [],
    replayGain: {
      trackGain: 0,
      trackPeak: 0,
      albumGain: 0,
      albumPeak: 0,
    },
    ...overrides,
  };
}

function makePlaylist(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Playlist ${id}`,
    songCount: 2,
    duration: 300,
    created: "2024-01-01T00:00:00.000Z",
    owner: "admin",
    public: true,
    starredAt: 1,
    ...overrides,
  };
}

describe("smartDownloadEngine", () => {
  beforeEach(async () => {
    cacheSmartSong.mockReset();
    cacheStorageDelete.mockReset();
    cacheStorageDelete.mockResolvedValue(undefined);
    persistCacheMeta.mockReset();
    persistCacheMeta.mockResolvedValue(undefined);
    deleteCacheMeta.mockReset();
    deleteCacheMeta.mockResolvedValue(undefined);
    await _resetLibraryDbForTests();
    useCacheIndexStore.setState({
      items: {},
      loaded: true,
    });
    useCacheStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        smartRules: {
          ...state.settings.smartRules,
          enabled: true,
          favoriteSongs: true,
          favoritePlaylists: false,
        },
      },
    }));
  });

  it("caches new songs that match a smart-download rule", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    await libraryDb.songs.bulkPut([
      makeSong("starred-song", { starredAt: 1 }),
      makeSong("unstarred-song", { starredAt: 0 }),
    ]);

    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).toHaveBeenCalledWith("starred-song", ["favorite"]);
    expect(cacheSmartSong).not.toHaveBeenCalledWith(
      "unstarred-song",
      expect.anything(),
    );
  });

  it("does nothing when smart rules are disabled", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");
    useCacheStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        smartRules: {
          enabled: false,
          favoriteSongs: true,
          favoritePlaylists: true,
        },
      },
    }));

    await libraryDb.songs.bulkPut([makeSong("s1", { starredAt: 1 })]);
    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).not.toHaveBeenCalled();
  });

  it("evicts smart entries no longer matching any rule", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheIndexStore.setState({
      items: {
        "audio:old-smart": {
          id: "old-smart",
          type: "audio",
          source: "smart",
          triggers: ["favorite"],
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    await smartDownloadEngine.recomputeMatches();

    expect(cacheStorageDelete).toHaveBeenCalledWith("audio:old-smart");
  });

  it("does not evict explicit entries", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheIndexStore.setState({
      items: {
        "audio:explicit-song": {
          id: "explicit-song",
          type: "audio",
          source: "explicit",
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    await smartDownloadEngine.recomputeMatches();

    expect(cacheStorageDelete).not.toHaveBeenCalled();
  });

  it("updates triggers for existing smart entries when they change", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheIndexStore.setState({
      items: {
        "audio:starred-song": {
          id: "starred-song",
          type: "audio",
          source: "smart",
          triggers: ["playlist"],
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    await libraryDb.songs.bulkPut([makeSong("starred-song", { starredAt: 1 })]);

    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).not.toHaveBeenCalled();
    expect(
      useCacheIndexStore.getState().items["audio:starred-song"].triggers,
    ).toEqual(["favorite"]);
  });

  it("does not touch explicit entries that match a rule", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheIndexStore.setState({
      items: {
        "audio:explicit-song": {
          id: "explicit-song",
          type: "audio",
          source: "explicit",
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    await libraryDb.songs.bulkPut([
      makeSong("explicit-song", { starredAt: 1 }),
    ]);
    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).not.toHaveBeenCalledWith(
      "explicit-song",
      expect.anything(),
    );
  });

  it("caches starred playlist songs when favoritePlaylists is enabled", async () => {
    const { subsonic } = await import("@/service/subsonic");
    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        smartRules: {
          enabled: true,
          favoriteSongs: false,
          favoritePlaylists: true,
        },
      },
    }));

    await libraryDb.playlists.bulkPut([makePlaylist("pl-1", { id: "pl-1" })]);

    (subsonic.playlists.getOne as ReturnType<typeof vi.fn>).mockResolvedValue({
      entry: [{ id: "song-from-pl" }],
    });

    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).toHaveBeenCalledWith("song-from-pl", ["playlist"]);
  });

  it("skips playlist caching when offline", async () => {
    const { getNetworkStatus } = await import("@/app/hooks/use-network-status");
    (getNetworkStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      isOnline: false,
    });

    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        smartRules: {
          enabled: true,
          favoriteSongs: false,
          favoritePlaylists: true,
        },
      },
    }));

    await libraryDb.playlists.bulkPut([
      makePlaylist("pl-offline", { id: "pl-offline" }),
    ]);

    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).not.toHaveBeenCalled();
  });

  it("prevents re-entrant recomputation", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    cacheSmartSong.mockImplementation(
      () => new Promise((r) => setTimeout(r, 50)),
    );

    await libraryDb.songs.bulkPut([makeSong("starred-1", { starredAt: 1 })]);
    const p1 = smartDownloadEngine.recomputeMatches();
    const p2 = smartDownloadEngine.recomputeMatches();
    await Promise.all([p1, p2]);

    expect(cacheSmartSong).toHaveBeenCalledTimes(1);
  });

  it("adds multiple triggers for a song matching multiple rules", async () => {
    const { subsonic } = await import("@/service/subsonic");
    const { getNetworkStatus } = await import("@/app/hooks/use-network-status");
    (getNetworkStatus as ReturnType<typeof vi.fn>).mockReturnValue({
      isOnline: true,
    });
    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        smartRules: {
          enabled: true,
          favoriteSongs: true,
          favoritePlaylists: true,
        },
      },
    }));

    await libraryDb.songs.bulkPut([makeSong("dual-song", { starredAt: 1 })]);
    await libraryDb.playlists.bulkPut([makePlaylist("pl-1", { id: "pl-1" })]);

    (subsonic.playlists.getOne as ReturnType<typeof vi.fn>).mockResolvedValue({
      entry: [{ id: "dual-song" }],
    });

    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).toHaveBeenCalledWith("dual-song", [
      "favorite",
      "playlist",
    ]);
  });

  it("evicts smart entry when song exists but is no longer starred", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    useCacheIndexStore.setState({
      items: {
        "audio:formerly-starred": {
          id: "formerly-starred",
          type: "audio",
          source: "smart",
          triggers: ["favorite"],
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    await libraryDb.songs.bulkPut([
      makeSong("formerly-starred", { starredAt: 0 }),
    ]);

    await smartDownloadEngine.recomputeMatches();

    expect(cacheStorageDelete).toHaveBeenCalledWith("audio:formerly-starred");
    expect(deleteCacheMeta).toHaveBeenCalledWith("audio:formerly-starred");
  });
});
