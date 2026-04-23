import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCacheIndexStore } from "@/store/cache-index.store";
import { useCacheStore } from "@/store/cache.store";
import { _resetLibraryDbForTests, libraryDb } from "@/store/library-db";

const cacheSmartSong = vi.fn();

vi.mock("./cache-manager", () => ({
  cacheManager: {
    cacheSmartSong,
  },
}));

vi.mock("@/service/subsonic", () => ({
  subsonic: {
    playlists: {
      getOne: vi.fn(),
    },
  },
}));

describe("smartDownloadEngine", () => {
  beforeEach(async () => {
    cacheSmartSong.mockReset();
    await _resetLibraryDbForTests();
    useCacheIndexStore.setState({
      items: {},
      loaded: true,
    });
    useCacheStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        smartQuota: 100,
        smartRules: {
          ...state.settings.smartRules,
          enabled: true,
          favoriteSongs: true,
          favoritePlaylists: false,
        },
      },
    }));
  });

  it("does not admit new smart downloads when the smart pool is full", async () => {
    const { smartDownloadEngine } = await import("./smart-download-engine");

    await libraryDb.songs.bulkPut([
      makeSong("existing", { starredAt: 1, size: 100 }),
      makeSong("new", { starredAt: 1, size: 50 }),
    ]);

    useCacheIndexStore.setState((state) => ({
      ...state,
      items: {
        "audio/existing": {
          id: "existing",
          type: "audio",
          source: "smart",
          triggers: ["favorite"],
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
    }));

    await smartDownloadEngine.recomputeMatches();

    expect(cacheSmartSong).not.toHaveBeenCalled();
  });
});

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
