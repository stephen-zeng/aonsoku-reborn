import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetLibraryDbForTests, libraryDb } from "@/store/library-db";
import {
  AlbumsFilters,
  SongsOrderByOptions,
  SortOptions,
  YearSortOptions,
} from "@/utils/albumsFilter";
import {
  getOfflineAlbumDetail,
  getOfflineAlbumsList,
  getOfflineArtistDetail,
  getOfflinePlaylistDetail,
  getOfflineSongsList,
  idbFirstQueryFn,
  offlineData,
} from "./offlineQueryClient";

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

describe("offline detail readers", () => {
  it("reconstructs a full album detail from the album row and songs table", async () => {
    await libraryDb.albums.put({
      id: "album-1",
      name: "Offline Album",
      artist: "Artist",
      artistId: "artist-1",
      coverArt: "cover-1",
      songCount: 2,
      duration: 300,
      playCount: 0,
      created: "2024-01-01T00:00:00.000Z",
      year: 2024,
      genre: "rock",
      userRating: 0,
      genres: [],
      musicBrainzId: "",
      isCompilation: false,
      sortName: "Offline Album",
      discTitles: [],
    });
    await libraryDb.songs.bulkPut([
      makeSong("song-b", {
        albumId: "album-1",
        album: "Offline Album",
        artistId: "artist-1",
        artist: "Artist",
        track: 2,
      }),
      makeSong("song-a", {
        albumId: "album-1",
        album: "Offline Album",
        artistId: "artist-1",
        artist: "Artist",
        track: 1,
      }),
    ]);

    const album = await getOfflineAlbumDetail("album-1");

    expect(album.song.map((song) => song.id)).toEqual(["song-a", "song-b"]);
    expect(album.name).toBe("Offline Album");
  });

  it("marks album as songsUnavailable when track detail is missing", async () => {
    await libraryDb.albums.put({
      id: "album-1",
      name: "Offline Album",
      artist: "Artist",
      artistId: "artist-1",
      coverArt: "cover-1",
      songCount: 2,
      duration: 300,
      playCount: 0,
      created: "2024-01-01T00:00:00.000Z",
      year: 2024,
      genre: "rock",
      userRating: 0,
      genres: [],
      musicBrainzId: "",
      isCompilation: false,
      sortName: "Offline Album",
      discTitles: [],
    });

    const result = await getOfflineAlbumDetail("album-1");
    expect(result.songsUnavailable).toBe(true);
    expect(result.song).toEqual([]);
  });

  it("reconstructs artist detail with sorted offline albums", async () => {
    await libraryDb.artists.put({
      id: "artist-1",
      name: "Artist",
      albumCount: 2,
      coverArt: "artist-cover",
      artistImageUrl: "",
    });
    await libraryDb.albums.bulkPut([
      makeAlbum("album-1", {
        artistId: "artist-1",
        artist: "Artist",
        year: 2021,
      }),
      makeAlbum("album-2", {
        artistId: "artist-1",
        artist: "Artist",
        year: 2024,
      }),
    ]);

    const artist = await getOfflineArtistDetail("artist-1");

    expect(artist.album?.map((album) => album.id)).toEqual([
      "album-2",
      "album-1",
    ]);
  });

  it("reads playlist detail rows from the offline detail table", async () => {
    await libraryDb.playlistDetails.put({
      ...makePlaylist("playlist-1"),
      entry: [
        makeSong("song-1", { title: "First" }),
        makeSong("song-2", { title: "Second" }),
      ],
    });

    const playlist = await getOfflinePlaylistDetail("playlist-1");

    expect(playlist.name).toBe("Playlist playlist-1");
    expect(playlist.entry.map((song) => song.id)).toEqual(["song-1", "song-2"]);
  });
});

describe("offline list readers", () => {
  it("builds album skeletons from songs when the albums table is empty", async () => {
    await libraryDb.songs.bulkPut([
      makeSong("song-1", {
        albumId: "album-1",
        album: "Alpha",
        artist: "Artist A",
        artistId: "artist-a",
        playCount: 3,
      }),
      makeSong("song-2", {
        albumId: "album-1",
        album: "Alpha",
        artist: "Artist A",
        artistId: "artist-a",
        playCount: 7,
      }),
    ]);

    const albums = await getOfflineAlbumsList({
      currentFilter: AlbumsFilters.RecentlyAdded,
      yearFilter: YearSortOptions.Oldest,
      genre: "",
      artistId: "",
      query: "",
    });

    expect(albums).toHaveLength(1);
    expect(albums[0].songCount).toBe(2);
    expect(albums[0].playCount).toBe(10);
  });

  it("filters offline albums by search query", async () => {
    await libraryDb.albums.bulkPut([
      makeAlbum("album-1", { name: "Alpha" }),
      makeAlbum("album-2", { name: "Beta" }),
    ]);

    const albums = await getOfflineAlbumsList({
      currentFilter: AlbumsFilters.Search,
      yearFilter: YearSortOptions.Oldest,
      genre: "",
      artistId: "",
      query: "alp",
    });

    expect(albums.map((album) => album.id)).toEqual(["album-1"]);
  });

  it("sorts offline songs using the same order options as the network path", async () => {
    await libraryDb.songs.bulkPut([
      makeSong("song-1", {
        title: "Zulu",
        album: "Alpha",
        artist: "Artist B",
        created: "2024-01-01T00:00:00.000Z",
      }),
      makeSong("song-2", {
        title: "Alpha",
        album: "Beta",
        artist: "Artist A",
        created: "2024-02-01T00:00:00.000Z",
      }),
    ]);

    const songs = await getOfflineSongsList({
      filter: "",
      query: "",
      artistId: "",
      orderBy: SongsOrderByOptions.Title,
      sort: SortOptions.Asc,
    });

    expect(songs.map((song) => song.id)).toEqual(["song-2", "song-1"]);
  });
});

function makeAlbum(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Album ${id}`,
    artist: "Artist",
    artistId: "artist-1",
    coverArt: "",
    songCount: 1,
    duration: 180,
    playCount: 0,
    created: "2024-01-01T00:00:00.000Z",
    year: 2024,
    genre: "rock",
    userRating: 0,
    genres: [],
    musicBrainzId: "",
    isCompilation: false,
    sortName: `Album ${id}`,
    discTitles: [],
    ...overrides,
  };
}

function makePlaylist(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Playlist ${id}`,
    comment: "",
    songCount: 2,
    duration: 360,
    public: false,
    owner: "owner",
    created: "2024-01-01T00:00:00.000Z",
    changed: "2024-01-01T00:00:00.000Z",
    coverArt: "",
    ...overrides,
  };
}

function makeSong(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    parent: "parent",
    isDir: false,
    title: `Song ${id}`,
    album: "Album",
    artist: "Artist",
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
    albumId: "album-1",
    artistId: "artist-1",
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
