import { clear as idbClear, createStore, get, set } from "idb-keyval";
import type { Albums, SingleAlbum } from "@/types/responses/album";
import type { ISimilarArtist } from "@/types/responses/artist";
import type { Genre } from "@/types/responses/genre";
import type { Playlist } from "@/types/responses/playlist";
import type { ISong } from "@/types/responses/song";

const store = createStore("aonsoku-metadata-cache", "metadata");

const KEYS = {
  songs: "sync:songs",
  albums: "sync:albums",
  artists: "sync:artists",
  playlists: "sync:playlists",
  genres: "sync:genres",
  meta: "sync:meta",
} as const;

export interface SyncMeta {
  lastSyncedAt: number;
  songCount: number;
  albumCount: number;
  artistCount: number;
  playlistCount: number;
  genreCount: number;
}

// ── Write operations ──

async function putSongs(songs: ISong[]): Promise<void> {
  await set(KEYS.songs, songs, store);
}

async function putAlbums(albums: Albums[]): Promise<void> {
  await set(KEYS.albums, albums, store);
}

async function putArtists(artists: ISimilarArtist[]): Promise<void> {
  await set(KEYS.artists, artists, store);
}

async function putPlaylists(playlists: Playlist[]): Promise<void> {
  await set(KEYS.playlists, playlists, store);
}

async function putGenres(genres: Genre[]): Promise<void> {
  await set(KEYS.genres, genres, store);
}

async function putMeta(meta: SyncMeta): Promise<void> {
  await set(KEYS.meta, meta, store);
}

// ── Read operations ──

async function getSongs(): Promise<ISong[]> {
  return (await get<ISong[]>(KEYS.songs, store)) ?? [];
}

async function getAlbums(): Promise<Albums[]> {
  return (await get<Albums[]>(KEYS.albums, store)) ?? [];
}

async function getArtists(): Promise<ISimilarArtist[]> {
  return (await get<ISimilarArtist[]>(KEYS.artists, store)) ?? [];
}

async function getPlaylists(): Promise<Playlist[]> {
  return (await get<Playlist[]>(KEYS.playlists, store)) ?? [];
}

async function getGenres(): Promise<Genre[]> {
  return (await get<Genre[]>(KEYS.genres, store)) ?? [];
}

async function getMeta(): Promise<SyncMeta | null> {
  return (await get<SyncMeta>(KEYS.meta, store)) ?? null;
}

// ── Composite lookups ──

async function getAlbumWithSongs(
  albumId: string,
): Promise<SingleAlbum | undefined> {
  const albums = await getAlbums();
  const album = albums.find((a) => a.id === albumId);
  if (!album) return undefined;

  const songs = await getSongs();
  const albumSongs = songs.filter((s) => s.albumId === albumId);
  return { ...album, song: albumSongs } as SingleAlbum;
}

// ── Management ──

async function clear(): Promise<void> {
  await idbClear(store);
}

async function getTotalEntryCount(): Promise<number> {
  const meta = await getMeta();
  if (!meta) return 0;
  return (
    meta.songCount +
    meta.albumCount +
    meta.artistCount +
    meta.playlistCount +
    meta.genreCount
  );
}

export const metadataCache = {
  putSongs,
  putAlbums,
  putArtists,
  putPlaylists,
  putGenres,
  putMeta,
  getSongs,
  getAlbums,
  getArtists,
  getPlaylists,
  getGenres,
  getMeta,
  getAlbumWithSongs,
  clear,
  getTotalEntryCount,
};
