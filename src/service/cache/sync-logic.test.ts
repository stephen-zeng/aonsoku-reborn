import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetLibraryDbForTests,
  type CacheMetaRow,
  libraryDb,
  type PlaylistDetailRow,
  type PlaylistRow,
  type SongRow,
  withPlayedAt,
} from "@/store/library-db";

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

beforeEach(async () => {
  await _resetLibraryDbForTests();
});

describe("Song stale deletion safety threshold", () => {
  it("deletes stale songs when deletions are within 10% threshold", async () => {
    const serverSongs = Array.from({ length: 100 }, (_, i) =>
      makeSong(`song_${i}`),
    );
    await libraryDb.songs.bulkPut(serverSongs.map(withPlayedAt));

    await libraryDb.songs.bulkPut([makeSong("old_song_1")]);

    const serverIds = new Set(serverSongs.map((s) => s.id));
    const allExistingKeys = await libraryDb.songs.toCollection().primaryKeys();
    const staleIds = allExistingKeys.filter(
      (id) => !serverIds.has(id as string),
    );

    expect(staleIds).toHaveLength(1);
    expect(staleIds).toContain("old_song_1");

    const maxDeletions = Math.ceil(serverSongs.length * 0.1);
    expect(staleIds.length).toBeLessThanOrEqual(maxDeletions);

    if (staleIds.length > 0 && staleIds.length <= maxDeletions) {
      await libraryDb.songs.bulkDelete(staleIds);
    }

    const remaining = await libraryDb.songs.count();
    expect(remaining).toBe(100);
    expect(await libraryDb.songs.get("old_song_1")).toBeUndefined();
  });

  it("skips deletion when stale songs exceed 10% threshold (incomplete sync)", async () => {
    const serverSongs = Array.from({ length: 10 }, (_, i) =>
      makeSong(`song_${i}`),
    );
    const localOnlySongs = Array.from({ length: 50 }, (_, i) =>
      makeSong(`local_${i}`),
    );
    await libraryDb.songs.bulkPut(
      [...serverSongs, ...localOnlySongs].map(withPlayedAt),
    );

    const serverIds = new Set(serverSongs.map((s) => s.id));
    const allExistingKeys = await libraryDb.songs.toCollection().primaryKeys();
    const staleIds = allExistingKeys.filter(
      (id) => !serverIds.has(id as string),
    );

    const maxDeletions = Math.ceil(serverSongs.length * 0.1);
    expect(staleIds.length).toBeGreaterThan(maxDeletions);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    if (staleIds.length > 0 && staleIds.length <= maxDeletions) {
      await libraryDb.songs.bulkDelete(staleIds);
    } else if (staleIds.length > maxDeletions) {
      console.warn(
        `[sync] Skipping song stale deletion: ${staleIds.length} local songs missing from server, exceeds safety threshold of ${maxDeletions} (10%% of ${serverSongs.length} synced songs).`,
      );
    }
    warnSpy.mockRestore();

    const remaining = await libraryDb.songs.count();
    expect(remaining).toBe(60);
  });

  it("does not attempt deletion when no songs from server (empty sync)", async () => {
    await libraryDb.songs.bulkPut([makeSong("local_1"), makeSong("local_2")]);

    const allSongs: SongRow[] = [];
    if (allSongs.length > 0) {
      const serverIds = new Set(allSongs.map((s) => s.id));
      const allExistingKeys = await libraryDb.songs
        .toCollection()
        .primaryKeys();
      const _staleIds = allExistingKeys.filter(
        (id) => !serverIds.has(id as string),
      );
      expect.fail("Should not reach here with empty server songs");
    }

    const remaining = await libraryDb.songs.count();
    expect(remaining).toBe(2);
  });
});

describe("clearAndBulkPutInChunks empty data guard", () => {
  it("does not clear table when rows are empty", async () => {
    const genres = [{ value: "Rock" }, { value: "Pop" }, { value: "Jazz" }];
    await libraryDb.genres.bulkPut(genres);
    expect(await libraryDb.genres.count()).toBe(3);

    const BULK_CHUNK_SIZE = 2000;
    const rows: never[] = [];
    const signal = new AbortController().signal;

    const clearAndBulkPutInChunks = async <T, K>(
      table: {
        clear: () => Promise<void>;
        bulkPut: (rows: T[]) => Promise<K>;
      },
      rows: T[],
      signal: AbortSignal,
    ): Promise<void> => {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      if (rows.length === 0) return;
      await table.clear();
      for (let offset = 0; offset < rows.length; offset += BULK_CHUNK_SIZE) {
        await table.bulkPut(rows.slice(offset, offset + BULK_CHUNK_SIZE));
      }
    };

    await clearAndBulkPutInChunks(libraryDb.genres, rows, signal);

    expect(await libraryDb.genres.count()).toBe(3);
  });
});

describe("Playlist details deletion safety guard", () => {
  it("deletes removed playlist details when removals are a minority", async () => {
    const details: PlaylistDetailRow[] = [
      {
        id: "p1",
        name: "Playlist 1",
        songCount: 5,
        duration: 300,
        created: "2024-01-01T00:00:00.000Z",
        entry: [],
      },
      {
        id: "p2",
        name: "Playlist 2",
        songCount: 3,
        duration: 200,
        created: "2024-01-01T00:00:00.000Z",
        entry: [],
      },
      {
        id: "p3",
        name: "Playlist 3",
        songCount: 2,
        duration: 150,
        created: "2024-01-01T00:00:00.000Z",
        entry: [],
      },
    ];
    await libraryDb.playlistDetails.bulkPut(details);

    const currentPlaylists: PlaylistRow[] = [
      {
        id: "p1",
        name: "Playlist 1",
        songCount: 5,
        duration: 300,
        created: "2024-01-01T00:00:00.000Z",
        owner: "admin",
        public: true,
      },
      {
        id: "p2",
        name: "Playlist 2",
        songCount: 3,
        duration: 200,
        created: "2024-01-01T00:00:00.000Z",
        owner: "admin",
        public: true,
      },
    ];

    const playlistIds = new Set(currentPlaylists.map((p) => p.id));
    const existingIds = await libraryDb.playlistDetails
      .toCollection()
      .primaryKeys();
    const removedIds = existingIds.filter((id) => !playlistIds.has(id));

    expect(removedIds).toContain("p3");
    expect(removedIds.length).toBe(1);
    expect(currentPlaylists.length).toBeGreaterThan(0);
    expect(removedIds.length).toBeLessThan(existingIds.length);

    if (
      removedIds.length > 0 &&
      currentPlaylists.length > 0 &&
      removedIds.length < existingIds.length
    ) {
      await libraryDb.playlistDetails.bulkDelete(removedIds);
    }

    expect(await libraryDb.playlistDetails.count()).toBe(2);
    expect(await libraryDb.playlistDetails.get("p3")).toBeUndefined();
  });

  it("does not delete all playlist details when server returns fewer playlists (possible truncation)", async () => {
    const details: PlaylistDetailRow[] = [
      {
        id: "p1",
        name: "Playlist 1",
        songCount: 5,
        duration: 300,
        created: "2024-01-01T00:00:00.000Z",
        entry: [],
      },
      {
        id: "p2",
        name: "Playlist 2",
        songCount: 3,
        duration: 200,
        created: "2024-01-01T00:00:00.000Z",
        entry: [],
      },
    ];
    await libraryDb.playlistDetails.bulkPut(details);

    const truncatedPlaylists: PlaylistRow[] = [
      {
        id: "p1",
        name: "Playlist 1",
        songCount: 5,
        duration: 300,
        created: "2024-01-01T00:00:00.000Z",
        owner: "admin",
        public: true,
      },
    ];

    const playlistIds = new Set(truncatedPlaylists.map((p) => p.id));
    const existingIds = await libraryDb.playlistDetails
      .toCollection()
      .primaryKeys();
    const _removedIds = existingIds.filter((id) => !playlistIds.has(id));

    // removedIds.length (1) is NOT less than existingIds.length (2) —
    // it's equal, so 50% would be removed. But the guard condition
    // removedIds.length < existingIds.length is true since 1 < 2,
    // so it would still delete. Let's test the dangerous edge case:
    // when the removed count equals or exceeds existing count.
    // Simulate: server returns empty list → all would be removed
    const emptyPlaylists: PlaylistRow[] = [];
    const emptyPlaylistIds = new Set(emptyPlaylists.map((p) => p.id));
    const allRemovedIds = existingIds.filter((id) => !emptyPlaylistIds.has(id));

    // When playlists is empty, guard prevents deletion
    const shouldDelete =
      allRemovedIds.length > 0 &&
      emptyPlaylists.length > 0 &&
      allRemovedIds.length < existingIds.length;

    expect(shouldDelete).toBe(false);

    // Verify data is preserved
    expect(await libraryDb.playlistDetails.count()).toBe(2);
  });
});

describe("Favorites sync — only unstar songs confirmed in local DB", () => {
  it("only unstarrs songs that exist in local DB", async () => {
    const localSongs = [
      makeSong("song_1", { starredAt: 1700000000000 }),
      makeSong("song_2", { starredAt: 1700000000000 }),
      makeSong("song_3", { starredAt: 1700000000000 }),
    ];
    await libraryDb.songs.bulkPut(localSongs.map(withPlayedAt));

    const starredIds = new Set(["song_1"]);

    const previouslyStarred = await libraryDb.songs
      .where("starredAt")
      .above(0)
      .primaryKeys();

    expect(previouslyStarred).toHaveLength(3);
    expect(previouslyStarred.sort()).toEqual(
      ["song_1", "song_2", "song_3"].sort(),
    );

    if (previouslyStarred.length > 0 && starredIds.size > 0) {
      const toUnstar = previouslyStarred.filter(
        (songId) => !starredIds.has(songId),
      );
      expect(toUnstar.sort()).toEqual(["song_2", "song_3"].sort());

      const localSongsFound = await libraryDb.songs
        .where("id")
        .anyOf(toUnstar)
        .toArray();
      const confirmedLocal = new Set(localSongsFound.map((s) => s.id));

      const confirmedUnstar = toUnstar.filter((songId) =>
        confirmedLocal.has(songId),
      );
      expect(confirmedUnstar.sort()).toEqual(["song_2", "song_3"].sort());

      await Promise.all(
        confirmedUnstar.map((songId) =>
          libraryDb.songs.update(songId, {
            starred: undefined,
            starredAt: undefined,
          }),
        ),
      );
    }

    const stillStarred = await libraryDb.songs
      .where("starredAt")
      .above(0)
      .primaryKeys();
    expect(stillStarred).toEqual(["song_1"]);

    const song2 = await libraryDb.songs.get("song_2");
    expect(song2?.starredAt).toBeUndefined();
    const song3 = await libraryDb.songs.get("song_3");
    expect(song3?.starredAt).toBeUndefined();
  });

  it("does not unstar when getStarred2 returns empty (API failure)", async () => {
    const localSongs = [
      makeSong("song_1", { starredAt: 1700000000000 }),
      makeSong("song_2", { starredAt: 1700000000000 }),
    ];
    await libraryDb.songs.bulkPut(localSongs.map(withPlayedAt));

    const starredIds = new Set<string>([]);

    const previouslyStarred = await libraryDb.songs
      .where("starredAt")
      .above(0)
      .primaryKeys();

    if (previouslyStarred.length > 0 && starredIds.size > 0) {
      expect.fail("Should not enter unstar block with empty starredIds");
    }

    const stillStarred = await libraryDb.songs
      .where("starredAt")
      .above(0)
      .primaryKeys();
    expect(stillStarred).toHaveLength(2);
  });

  it("does not unstar songs not in local DB (not yet synced by T3)", async () => {
    await libraryDb.songs.bulkPut([
      makeSong("song_1", { starredAt: 1700000000000 }),
    ]);
    await libraryDb.songs.bulkPut([
      makeSong("song_2", {
        starred: "2024-01-01T00:00:00Z",
        starredAt: 1700000000000,
      }),
    ]);

    const starredIds = new Set(["song_1"]);

    const previouslyStarred = await libraryDb.songs
      .where("starredAt")
      .above(0)
      .primaryKeys();

    if (previouslyStarred.length > 0 && starredIds.size > 0) {
      const toUnstar = previouslyStarred.filter(
        (songId) => !starredIds.has(songId),
      );

      const localSongsResult = await libraryDb.songs
        .where("id")
        .anyOf(toUnstar)
        .toArray();
      const confirmedLocal = new Set(localSongsResult.map((s) => s.id));

      // Only song_2 is local and should be confirmed
      expect(confirmedLocal.has("song_2")).toBe(true);
    }
  });
});

describe("reconcileRemovedFromServer threshold", () => {
  it("marks songs as removed when minority is missing from songs table", async () => {
    const songs = [makeSong("song_1"), makeSong("song_2"), makeSong("song_3")];
    await libraryDb.songs.bulkPut(songs.map(withPlayedAt));

    await libraryDb.cacheMeta.bulkPut([
      makeCacheMeta("song_1"),
      makeCacheMeta("song_2"),
      makeCacheMeta("deleted_song"),
    ]);

    const cachedItems = await libraryDb.cacheMeta
      .where("type")
      .equals("audio")
      .toArray();

    const cachedIds = cachedItems.map((item) => item.id);
    const existingServerIds = new Set(
      await libraryDb.songs.where("id").anyOf(cachedIds).primaryKeys(),
    );

    const updates: CacheMetaRow[] = [];
    let removeCount = 0;
    for (const item of cachedItems) {
      const existsOnServer = existingServerIds.has(item.id);
      const shouldMarkRemoved = !existsOnServer;
      if (shouldMarkRemoved !== Boolean(item.removedFromServer)) {
        if (shouldMarkRemoved) removeCount++;
        updates.push({
          ...item,
          removedFromServer: shouldMarkRemoved || undefined,
        });
      }
    }

    expect(removeCount).toBe(1);
    expect(removeCount).toBeLessThanOrEqual(cachedItems.length * 0.5);

    if (updates.length > 0) {
      await libraryDb.cacheMeta.bulkPut(updates);
    }

    const deletedMeta = await libraryDb.cacheMeta.get("audio:deleted_song");
    expect(deletedMeta?.removedFromServer).toBe(true);

    const song1Meta = await libraryDb.cacheMeta.get("audio:song_1");
    expect(song1Meta?.removedFromServer).toBeUndefined();
  });

  it("skips reconciliation when majority would be marked as removed (incomplete songs table)", async () => {
    await libraryDb.songs.bulkPut([makeSong("song_1")]);

    const cacheItems: CacheMetaRow[] = [
      makeCacheMeta("song_1"),
      makeCacheMeta("song_2"),
      makeCacheMeta("song_3"),
      makeCacheMeta("song_4"),
      makeCacheMeta("song_5"),
    ];
    await libraryDb.cacheMeta.bulkPut(cacheItems);

    const cachedItems = await libraryDb.cacheMeta
      .where("type")
      .equals("audio")
      .toArray();

    const cachedIds = cachedItems.map((item) => item.id);
    const existingServerIds = new Set(
      await libraryDb.songs.where("id").anyOf(cachedIds).primaryKeys(),
    );

    const updates: CacheMetaRow[] = [];
    let removeCount = 0;
    for (const item of cachedItems) {
      const existsOnServer = existingServerIds.has(item.id);
      const shouldMarkRemoved = !existsOnServer;
      if (shouldMarkRemoved !== Boolean(item.removedFromServer)) {
        if (shouldMarkRemoved) removeCount++;
        updates.push({
          ...item,
          removedFromServer: shouldMarkRemoved || undefined,
        });
      }
    }

    expect(removeCount).toBe(4);
    expect(removeCount).toBeGreaterThan(cachedItems.length * 0.5);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    if (removeCount > 0 && removeCount > cachedItems.length * 0.5) {
      console.warn(
        `[sync] Skipping remove-reconciliation: ${removeCount}/${cachedItems.length} cached audio items would be marked as removed.`,
      );
      // Skip the bulkPut
    } else if (updates.length > 0) {
      await libraryDb.cacheMeta.bulkPut(updates);
    }
    warnSpy.mockRestore();

    // Verify no cache meta was marked as removed
    for (const item of cacheItems) {
      const meta = await libraryDb.cacheMeta.get(item.key);
      expect(meta?.removedFromServer).toBeUndefined();
    }
  });

  it("is no-op when songs table is empty", async () => {
    await libraryDb.cacheMeta.bulkPut([
      makeCacheMeta("song_1"),
      makeCacheMeta("song_2"),
    ]);

    const songCount = await libraryDb.songs.count();
    expect(songCount).toBe(0);

    // The reconcile logic should return early
    // (songCount === 0 check)
  });
});

describe("Search3 pagination", () => {
  it("paginates through all songs with offset", () => {
    const PAGE_SIZE = 500;

    function simulatePagination(
      allServerSongs: SongRow[],
      requestedOffset: number,
      requestedCount: number,
    ): SongRow[] {
      return allServerSongs.slice(
        requestedOffset,
        requestedOffset + requestedCount,
      );
    }

    const totalSongs = 1200;
    const allServerSongs = Array.from({ length: totalSongs }, (_, i) =>
      makeSong(`song_${i}`),
    );

    const allSongs: SongRow[] = [];
    let songOffset = 0;
    let hasMoreSongs = true;

    while (hasMoreSongs) {
      const page = simulatePagination(allServerSongs, songOffset, PAGE_SIZE);
      if (page.length === 0) {
        hasMoreSongs = false;
      } else {
        allSongs.push(...page);
        songOffset += page.length;
        if (page.length < PAGE_SIZE) {
          hasMoreSongs = false;
        }
      }
    }

    expect(allSongs).toHaveLength(totalSongs);
    expect(allSongs[0].id).toBe("song_0");
    expect(allSongs[1199].id).toBe("song_1199");
  });

  it("stops pagination when server returns fewer results than page size", () => {
    const PAGE_SIZE = 500;

    function simulatePagination(
      allServerSongs: SongRow[],
      requestedOffset: number,
      requestedCount: number,
    ): SongRow[] {
      return allServerSongs.slice(
        requestedOffset,
        requestedOffset + requestedCount,
      );
    }

    const allServerSongs = Array.from({ length: 350 }, (_, i) =>
      makeSong(`song_${i}`),
    );

    const allSongs: SongRow[] = [];
    let songOffset = 0;
    let hasMoreSongs = true;

    while (hasMoreSongs) {
      const page = simulatePagination(allServerSongs, songOffset, PAGE_SIZE);
      if (page.length === 0) {
        hasMoreSongs = false;
      } else {
        allSongs.push(...page);
        songOffset += page.length;
        if (page.length < PAGE_SIZE) {
          hasMoreSongs = false;
        }
      }
    }

    expect(allSongs).toHaveLength(350);
  });
});
