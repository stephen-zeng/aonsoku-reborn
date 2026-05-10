import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SyncWorkerService,
  TIER_FRESH_WINDOW_MS,
  BULK_CHUNK_SIZE,
  PLAYLIST_DETAIL_BATCH_SIZE,
  bulkPutInChunks,
} from "@/service/cache/sync-worker-service";
import {
  _resetLibraryDbForTests,
  libraryDb,
  withPlayedAt,
  type SongRow,
  type CacheMetaRow,
} from "@/store/library-db";

vi.mock("@/api/workerHttpClient", () => ({
  workerHttpClient: vi.fn(),
  initAuth: vi.fn(),
  updateAuth: vi.fn(),
  ensureAuth: vi.fn(() => ({
    url: "http://test-server.local",
    username: "admin",
    password: "admin",
    authType: "token",
    protocolVersion: "1.16.0",
    serverType: "navidrome",
  })),
}));

vi.mock("@/api/urlBuilder", () => ({
  buildCoverArtUrl: vi.fn(
    () => "http://test-server.local/rest/getCoverArt?id=test",
  ),
}));

vi.mock("comlink", () => ({
  expose: vi.fn(),
  wrap: vi.fn(),
}));

const mockWorkerHttpClient = vi.mocked(
  await import("@/api/workerHttpClient"),
).workerHttpClient;

function makeSong(id: string, overrides: Partial<SongRow> = {}): SongRow {
  return {
    id,
    parent: "album_1",
    isDir: false,
    title: `Song ${id}`,
    album: "Album 1",
    artist: "Artist 1",
    track: 1,
    year: 2024,
    coverArt: `cover_${id}`,
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

function makeCacheMeta(
  id: string,
  overrides: Partial<CacheMetaRow> = {},
): CacheMetaRow {
  return {
    key: `audio:${id}`,
    id,
    type: "audio",
    source: "explicit",
    sizeBytes: 100,
    cachedAt: Date.now(),
    lastAccessedAt: Date.now(),
    ...overrides,
  };
}

let service: SyncWorkerService;
let callbacks: {
  onSyncStateUpdate: ReturnType<typeof vi.fn>;
  onInvalidateQueries: ReturnType<typeof vi.fn>;
  onLastSyncedAt: ReturnType<typeof vi.fn>;
  onCacheIndexRefresh: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  await _resetLibraryDbForTests();
  vi.clearAllMocks();
  mockWorkerHttpClient.mockReset();

  service = new SyncWorkerService(libraryDb);
  callbacks = {
    onSyncStateUpdate: vi.fn(),
    onInvalidateQueries: vi.fn(),
    onLastSyncedAt: vi.fn(),
    onCacheIndexRefresh: vi.fn(),
  };
  service.setCallbacks(callbacks);

  service.initAuth({
    url: "http://test.local",
    username: "admin",
    password: "admin",
    authType: "token",
    serverType: "navidrome",
  });
});

function mockT1(opts?: { playlists?: unknown[]; starredSongs?: unknown[] }) {
  const playlists = opts?.playlists ?? [];
  const starredSongs = opts?.starredSongs ?? [];
  mockWorkerHttpClient
    .mockResolvedValueOnce({
      count: 0,
      data: {
        genres: { genre: [] },
        status: "ok",
      },
    })
    .mockResolvedValueOnce({
      count: 0,
      data: {
        playlists: { playlist: playlists },
        status: "ok",
      },
    });
  if (playlists.length > 0) {
    for (const _p of playlists) {
      mockWorkerHttpClient.mockResolvedValueOnce({
        count: 0,
        data: {
          playlist: { ..._p, entry: [] },
          status: "ok",
        },
      });
    }
  }
  mockWorkerHttpClient.mockResolvedValueOnce({
    count: 0,
    data: {
      starred2: { song: starredSongs },
      status: "ok",
    },
  });
}

function mockT2(opts?: { artists?: unknown[]; albums?: unknown[] }) {
  const artists = opts?.artists ?? [];
  const albums = opts?.albums ?? [];
  mockWorkerHttpClient
    .mockResolvedValueOnce({
      count: 0,
      data: {
        artists: {
          index: artists.length > 0 ? [{ name: "A", artist: artists }] : [],
        },
        status: "ok",
      },
    })
    .mockResolvedValueOnce({
      count: albums.length,
      data: {
        albumList2: { album: albums },
        status: "ok",
      },
    });
}

function mockT3(opts?: { songs?: unknown[] }) {
  const songs = opts?.songs ?? [];
  mockWorkerHttpClient.mockResolvedValueOnce({
    count: songs.length,
    data: {
      searchResult3: { song: songs },
      status: "ok",
    },
  });
}

describe("SyncWorkerService", () => {
  describe("initAuth", () => {
    it("calls workerInitAuth with the config", async () => {
      const { initAuth } = await import("@/api/workerHttpClient");
      const fresh = new SyncWorkerService(libraryDb);
      fresh.setCallbacks(callbacks);
      fresh.initAuth({
        url: "http://example.local",
        username: "user",
        password: "pass",
        authType: "token",
      });
      expect(initAuth).toHaveBeenCalledWith(
        expect.objectContaining({ url: "http://example.local" }),
      );
    });
  });

  describe("syncAll - T1", () => {
    it("syncs genres, playlists, and favorites", async () => {
      mockT1();
      mockT2();
      mockT3();

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const genres = await libraryDb.genres.toArray();
      expect(genres).toHaveLength(0);

      expect(callbacks.onInvalidateQueries).toHaveBeenCalledWith([
        ["playlists"],
        ["playlists", "single"],
        ["genres"],
        ["favorites", "count"],
        ["favorites", "list"],
        ["songs"],
      ]);
    });

    it("syncs played and starred timestamps on songs", async () => {
      const starredSong = makeSong("song_1");
      starredSong.starred = "2024-01-15T00:00:00Z";
      starredSong.played = "2024-01-14T00:00:00Z";

      mockT1({ starredSongs: [starredSong] });
      mockT2();
      mockT3();

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const songs = await libraryDb.songs.toArray();
      expect(songs.length).toBeGreaterThanOrEqual(1);
      const synced = songs.find((s) => s.id === "song_1");
      expect(synced).toBeDefined();
      expect(synced!.starredAt).toBeGreaterThan(0);
      expect(synced!.playedAt).toBeGreaterThan(0);
    });

    it("unstarrs songs no longer starred on server", async () => {
      const localSongs = [
        makeSong("song_1", { starredAt: 1700000000000 }),
        makeSong("song_2", { starredAt: 1700000000000 }),
      ];
      await libraryDb.songs.bulkPut(localSongs.map(withPlayedAt));

      const stillStarred = makeSong("song_1");
      stillStarred.starred = "2024-01-15T00:00:00Z";

      mockT1({ starredSongs: [stillStarred] });
      mockT2();
      mockT3();

      await service.syncAll({
        includeFullSongs: false,
        includeCoverArt: false,
      });

      const song2 = await libraryDb.songs.get("song_2");
      expect(song2?.starredAt).toBeUndefined();
    });
  });

  describe("syncAll - T2", () => {
    it("syncs artists and clears old ones", async () => {
      await libraryDb.artists.bulkPut([
        {
          id: "old_artist",
          name: "Old Artist",
          albumCount: 0,
          coverArt: "",
          artistImageUrl: "",
          starredAt: undefined,
        },
      ]);

      const artists = [
        {
          id: "ar_1",
          name: "Alpha",
          albumCount: 1,
          coverArt: "",
          artistImageUrl: "",
        },
        {
          id: "ar_2",
          name: "Beta",
          albumCount: 2,
          coverArt: "",
          artistImageUrl: "",
        },
      ];

      mockT1();
      mockT2({ artists });
      mockT3();

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const saved = await libraryDb.artists.toArray();
      expect(saved).toHaveLength(2);
      expect(saved.find((a) => a.id === "old_artist")).toBeUndefined();

      expect(callbacks.onInvalidateQueries).toHaveBeenCalledWith([
        ["artists"],
        ["albums"],
      ]);
    });

    it("syncs albums with pagination", async () => {
      const albums = Array.from({ length: 3 }, (_, i) => ({
        id: `album_${i}`,
        name: `Album ${i}`,
        artist: "Artist",
        songCount: 5,
        duration: 300,
        created: "2024-01-01T00:00:00.000Z",
      }));

      mockT1();
      mockT2({ albums });
      mockT3();

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const saved = await libraryDb.albums.toArray();
      expect(saved).toHaveLength(3);
    });
  });

  describe("syncAll - T3", () => {
    it("syncs songs and performs stale deletion within safety threshold", async () => {
      await libraryDb.songs.bulkPut(
        [
          makeSong("song_0"),
          ...Array.from({ length: 9 }, (_, i) => makeSong(`song_${i + 1}`)),
          makeSong("old_song"),
        ].map(withPlayedAt),
      );

      const serverSongs = Array.from({ length: 10 }, (_, i) =>
        makeSong(`song_${i}`),
      );

      mockT1();
      mockT2();
      mockT3({ songs: serverSongs });

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const remaining = await libraryDb.songs.toArray();
      expect(remaining.find((s) => s.id === "old_song")).toBeUndefined();
      expect(remaining).toHaveLength(10);
    });

    it("skips stale deletion when exceeding 10% threshold", async () => {
      const localSongs = Array.from({ length: 60 }, (_, i) =>
        makeSong(`local_${i}`),
      );
      await libraryDb.songs.bulkPut(localSongs.map(withPlayedAt));

      const serverSongs = Array.from({ length: 10 }, (_, i) =>
        makeSong(`song_${i}`),
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockT1();
      mockT2();
      mockT3({ songs: serverSongs });

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Skipping song stale deletion"),
      );
      warnSpy.mockRestore();
    });

    it("uses navidrome-style query for serverType navidrome", async () => {
      mockT1();
      mockT2();
      mockT3();

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const searchCall = mockWorkerHttpClient.mock.calls.find(
        (call) => call[0] === "/search3",
      );
      expect(searchCall).toBeDefined();
      expect(
        (searchCall![1] as { query: Record<string, string> }).query.query,
      ).toBe('""');
    });
  });

  describe("syncAll - incremental mode", () => {
    it("skips tiers that were synced recently", async () => {
      const now = Date.now();
      await libraryDb.syncState.bulkPut([
        { key: "tier:t1", lastSyncedAt: now - 60_000 },
        { key: "tier:t2", lastSyncedAt: now - 60_000 },
        { key: "tier:t3", lastSyncedAt: now - 60_000 },
      ]);

      mockWorkerHttpClient.mockResolvedValue({
        count: 0,
        data: { status: "ok" },
      });

      await service.syncIncremental({
        includeFullSongs: true,
        includeCoverArt: false,
      });

      expect(mockWorkerHttpClient).not.toHaveBeenCalledWith(
        "/getGenres",
        expect.anything(),
      );
    });

    it("runs stale tiers", async () => {
      const now = Date.now();
      await libraryDb.syncState.bulkPut([
        { key: "tier:t1", lastSyncedAt: now - 10 * 60 * 1000 },
      ]);

      mockT1();
      mockT2();
      mockT3();

      await service.syncIncremental({
        includeFullSongs: true,
        includeCoverArt: false,
      });

      expect(mockWorkerHttpClient).toHaveBeenCalled();
    });
  });

  describe("syncAll - completion and error handling", () => {
    it("records full-sync timestamp and calls callbacks on success", async () => {
      mockT1();
      mockT2();
      mockT3();

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const syncState = await libraryDb.syncState.get("full-sync");
      expect(syncState?.lastSyncedAt).toBeGreaterThan(0);

      expect(callbacks.onLastSyncedAt).toHaveBeenCalledWith(expect.any(Number));
      expect(callbacks.onCacheIndexRefresh).toHaveBeenCalled();
    });

    it("sets error state on API failure", async () => {
      mockWorkerHttpClient.mockRejectedValue(new Error("Network error"));

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      expect(callbacks.onSyncStateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "error" }),
      );

      errorSpy.mockRestore();
    });

    it("sets cancelled state when abort is triggered", async () => {
      mockWorkerHttpClient.mockImplementation(async () => {
        throw new DOMException("Aborted", "AbortError");
      });

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      expect(callbacks.onSyncStateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "cancelled" }),
      );
    });
  });

  describe("reconcileRemovedFromServer", () => {
    it("marks cached audio as removedFromServer when song absent", async () => {
      await libraryDb.songs.bulkPut(
        [makeSong("song_1"), makeSong("song_2")].map(withPlayedAt),
      );

      await libraryDb.cacheMeta.bulkPut([
        makeCacheMeta("song_1"),
        makeCacheMeta("song_2"),
        makeCacheMeta("deleted_song"),
      ]);

      mockT1();
      mockT2();
      mockT3({ songs: [makeSong("song_1"), makeSong("song_2")] });

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const deletedMeta = await libraryDb.cacheMeta.get("audio:deleted_song");
      expect(deletedMeta?.removedFromServer).toBe(true);

      const song1Meta = await libraryDb.cacheMeta.get("audio:song_1");
      expect(song1Meta?.removedFromServer).toBeUndefined();
    });

    it("skips reconciliation when majority would be removed", async () => {
      await libraryDb.songs.bulkPut([makeSong("song_1")]);

      const cacheItems: CacheMetaRow[] = [
        makeCacheMeta("song_1"),
        makeCacheMeta("song_2"),
        makeCacheMeta("song_3"),
        makeCacheMeta("song_4"),
        makeCacheMeta("song_5"),
      ];
      await libraryDb.cacheMeta.bulkPut(cacheItems);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockT1();
      mockT2();
      mockT3({ songs: [makeSong("song_1")] });

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("remove-reconciliation"),
      );
      warnSpy.mockRestore();

      for (const item of cacheItems) {
        const meta = await libraryDb.cacheMeta.get(item.key);
        expect(meta?.removedFromServer).toBeUndefined();
      }
    });
  });

  describe("tier checkpoints", () => {
    it("records tier checkpoints after each tier", async () => {
      mockT1();
      mockT2();
      mockT3();

      await service.syncAll({ includeFullSongs: true, includeCoverArt: false });

      const t1 = await libraryDb.syncState.get("tier:t1");
      const t2 = await libraryDb.syncState.get("tier:t2");
      const t3 = await libraryDb.syncState.get("tier:t3");

      expect(t1?.lastSyncedAt).toBeGreaterThan(0);
      expect(t2?.lastSyncedAt).toBeGreaterThan(0);
      expect(t3?.lastSyncedAt).toBeGreaterThan(0);
    });
  });
});

describe("bulkPutInChunks", () => {
  it("puts rows in a single call when within chunk size", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `item_${i}` }));
    const table = { bulkPut: vi.fn().mockResolvedValue(undefined) };
    const signal = new AbortController().signal;

    await bulkPutInChunks(table, rows, signal);

    expect(table.bulkPut).toHaveBeenCalledTimes(1);
    expect(table.bulkPut).toHaveBeenCalledWith(rows);
  });

  it("throws AbortError when signal is already aborted", async () => {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ id: `item_${i}` }));
    const table = { bulkPut: vi.fn().mockResolvedValue(undefined) };
    const controller = new AbortController();
    controller.abort();

    await expect(
      bulkPutInChunks(table, rows, controller.signal),
    ).rejects.toThrow("Aborted");
  });
});

describe("TIER_FRESH_WINDOW_MS", () => {
  it("has correct fresh windows", () => {
    expect(TIER_FRESH_WINDOW_MS.t1).toBe(5 * 60 * 1000);
    expect(TIER_FRESH_WINDOW_MS.t2).toBe(30 * 60 * 1000);
    expect(TIER_FRESH_WINDOW_MS.t3).toBe(2 * 60 * 60 * 1000);
  });
});

describe("BULK_CHUNK_SIZE and PLAYLIST_DETAIL_BATCH_SIZE", () => {
  it("has expected values", () => {
    expect(BULK_CHUNK_SIZE).toBe(2000);
    expect(PLAYLIST_DETAIL_BATCH_SIZE).toBe(25);
  });
});
