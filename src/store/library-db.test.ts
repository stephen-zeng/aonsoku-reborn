import { clear as idbClear, set as idbSet } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { cacheIndexStore, offlineLibraryStore } from "@/store/idb";
import {
  _resetLibraryDbForTests,
  type ArtistRow,
  type CacheMetaRow,
  libraryDb,
  migrateLegacyStoresIfNeeded,
  type SongRow,
} from "./library-db";

beforeEach(async () => {
  await _resetLibraryDbForTests();
  await idbClear(offlineLibraryStore);
  await idbClear(cacheIndexStore);
});

describe("schema", () => {
  it("exposes all expected tables", () => {
    const names = libraryDb.tables.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "artists",
        "albums",
        "songs",
        "playlists",
        "playlistDetails",
        "genres",
        "cacheMeta",
        "lyrics",
        "syncState",
      ].sort(),
    );
  });

  it("indexes artists by name and starredAt", () => {
    const indexes = libraryDb.artists.schema.indexes.map((i) => i.name);
    expect(indexes).toContain("name");
    expect(indexes).toContain("starredAt");
  });

  it("indexes songs by album/artist/title/playCount/playedAt/starredAt", () => {
    const indexes = libraryDb.songs.schema.indexes.map((i) => i.name);
    expect(indexes).toEqual(
      expect.arrayContaining([
        "albumId",
        "artistId",
        "title",
        "starredAt",
        "playCount",
        "playedAt",
      ]),
    );
  });

  it("indexes cacheMeta by source and lastAccessedAt", () => {
    const indexes = libraryDb.cacheMeta.schema.indexes.map((i) => i.name);
    expect(indexes).toContain("source");
    expect(indexes).toContain("lastAccessedAt");
  });
});

describe("crud + indexes", () => {
  it("roundtrips an artist row", async () => {
    const row: ArtistRow = {
      id: "a1",
      name: "Fleet Foxes",
      albumCount: 6,
      coverArt: "",
      artistImageUrl: "",
    };
    await libraryDb.artists.put(row);
    const fetched = await libraryDb.artists.get("a1");
    expect(fetched?.name).toBe("Fleet Foxes");
  });

  it("finds starred artists via the starredAt index", async () => {
    const rows: ArtistRow[] = [
      {
        id: "a1",
        name: "A",
        albumCount: 1,
        coverArt: "",
        artistImageUrl: "",
        starredAt: 1_700_000_000_000,
      },
      {
        id: "a2",
        name: "B",
        albumCount: 1,
        coverArt: "",
        artistImageUrl: "",
      },
      {
        id: "a3",
        name: "C",
        albumCount: 1,
        coverArt: "",
        artistImageUrl: "",
        starredAt: 1_800_000_000_000,
      },
    ];
    await libraryDb.artists.bulkPut(rows);

    const starred = await libraryDb.artists
      .where("starredAt")
      .above(0)
      .toArray();
    expect(starred.map((r) => r.id).sort()).toEqual(["a1", "a3"]);
  });

  it("queries songs by albumId index with correct cardinality", async () => {
    const songs = Array.from({ length: 200 }, (_, i) => makeSong(i, i % 10));
    await libraryDb.songs.bulkPut(songs);

    const album3 = await libraryDb.songs
      .where("albumId")
      .equals("album_3")
      .toArray();
    expect(album3).toHaveLength(20);
    expect(album3.every((s) => s.albumId === "album_3")).toBe(true);
  });

  it("queries songs by playCount range", async () => {
    const songs: SongRow[] = [
      makeSong(1, 0, { playCount: 1 }),
      makeSong(2, 0, { playCount: 5 }),
      makeSong(3, 0, { playCount: 12 }),
      makeSong(4, 0, { playCount: 7 }),
    ];
    await libraryDb.songs.bulkPut(songs);

    const frequent = await libraryDb.songs
      .where("playCount")
      .aboveOrEqual(5)
      .toArray();
    expect(frequent.map((s) => s.id).sort()).toEqual([
      "song_2",
      "song_3",
      "song_4",
    ]);
  });
});

describe("cacheMeta", () => {
  it("queries by source for per-pool eviction", async () => {
    const rows: CacheMetaRow[] = [
      {
        key: "audio/1",
        id: "1",
        type: "audio",
        source: "explicit",
        sizeBytes: 100,
        cachedAt: 1,
        lastAccessedAt: 1,
      },
      {
        key: "audio/2",
        id: "2",
        type: "audio",
        source: "lru",
        sizeBytes: 100,
        cachedAt: 2,
        lastAccessedAt: 2,
      },
      {
        key: "audio/3",
        id: "3",
        type: "audio",
        source: "smart",
        sizeBytes: 100,
        cachedAt: 3,
        lastAccessedAt: 3,
      },
    ];
    await libraryDb.cacheMeta.bulkPut(rows);

    const lru = await libraryDb.cacheMeta
      .where("source")
      .equals("lru")
      .toArray();
    expect(lru.map((r) => r.key)).toEqual(["audio/2"]);
  });
});

describe("migration", () => {
  it("copies legacy library data into the new schema on first run", async () => {
    await idbSet(
      "offline-artists",
      [
        {
          id: "a1",
          name: "Legacy Artist",
          albumCount: 3,
          coverArt: "",
          artistImageUrl: "",
          starred: "2024-05-01T00:00:00.000Z",
        },
      ],
      offlineLibraryStore,
    );
    await idbSet(
      "offline-sync-timestamp",
      1_700_000_000_000,
      offlineLibraryStore,
    );

    const ran = await migrateLegacyStoresIfNeeded();
    expect(ran).toBe(true);

    const artist = await libraryDb.artists.get("a1");
    expect(artist?.name).toBe("Legacy Artist");
    expect(artist?.starredAt).toBe(Date.parse("2024-05-01T00:00:00.000Z"));

    const legacyTs = await libraryDb.syncState.get("_legacy");
    expect(legacyTs?.lastSyncedAt).toBe(1_700_000_000_000);
  });

  it("tags legacy cache-index entries as explicit to protect them", async () => {
    await idbSet(
      "cache-index-v1",
      {
        "audio/42": {
          id: "42",
          type: "audio",
          sizeBytes: 1024,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      cacheIndexStore,
    );

    await migrateLegacyStoresIfNeeded();

    const meta = await libraryDb.cacheMeta.get("audio/42");
    expect(meta?.source).toBe("explicit");
    expect(meta?.sizeBytes).toBe(1024);
  });

  it("is idempotent — second run is a no-op", async () => {
    await idbSet(
      "offline-artists",
      [
        {
          id: "a1",
          name: "A",
          albumCount: 1,
          coverArt: "",
          artistImageUrl: "",
        },
      ],
      offlineLibraryStore,
    );

    const first = await migrateLegacyStoresIfNeeded();
    const second = await migrateLegacyStoresIfNeeded();
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("does nothing when there is no legacy data (fresh install)", async () => {
    const ran = await migrateLegacyStoresIfNeeded();
    expect(ran).toBe(true); // marker is written even on empty migration

    expect(await libraryDb.artists.count()).toBe(0);
    expect(await libraryDb.songs.count()).toBe(0);
  });
});

// ─── helpers ─────────────────────────────────────────────────────────

function makeSong(
  i: number,
  albumBucket: number,
  overrides: Partial<SongRow> = {},
): SongRow {
  return {
    id: `song_${i}`,
    parent: `album_${albumBucket}`,
    isDir: false,
    title: `Song ${i}`,
    album: `Album ${albumBucket}`,
    artist: `Artist ${albumBucket % 5}`,
    track: i % 20,
    year: 2024,
    coverArt: "",
    size: 1,
    contentType: "audio/mpeg",
    suffix: "mp3",
    duration: 180,
    bitRate: 320,
    path: `path/${i}`,
    discNumber: 1,
    created: "2024-01-01T00:00:00.000Z",
    albumId: `album_${albumBucket}`,
    artistId: `artist_${albumBucket % 5}`,
    type: "music",
    isVideo: false,
    bpm: 0,
    comment: "",
    sortName: `Song ${i}`,
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
