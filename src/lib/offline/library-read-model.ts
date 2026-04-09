import { metadataCache } from "@/lib/cache/metadata-cache";
import { AlbumListParams } from "@/service/albums";
import { Albums } from "@/types/responses/album";
import { Genre } from "@/types/responses/genre";
import { Playlist } from "@/types/responses/playlist";
import { ISong } from "@/types/responses/song";
import {
  AlbumsFilters,
  SongsOrderByOptions,
  SortOptions,
} from "@/utils/albumsFilter";

interface OfflineSongSearchParams {
  query: string;
  songCount: number;
  songOffset: number;
  orderBy?: SongsOrderByOptions;
  sort?: SortOptions;
}

interface OfflineAlbumSearchParams {
  query: string;
  count: number;
  offset: number;
}

function normalize(value?: string) {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function matchesQuery(values: Array<string | undefined>, query: string) {
  const normalizedQuery = normalize(query);
  if (normalizedQuery === "") return true;

  return values.some((value) => normalize(value).includes(normalizedQuery));
}

function dateMs(value?: string): number {
  if (!value) return 0;
  return new Date(value).getTime() || 0;
}

function sortAlbumsByName(albums: Albums[]) {
  return [...albums].sort((a, b) =>
    (a.sortName || a.name || "").localeCompare(b.sortName || b.name || ""),
  );
}

function paginate<T>(list: T[], offset: number, size: number) {
  const items = list.slice(offset, offset + size);
  const nextOffset = offset + size < list.length ? offset + size : null;

  return {
    items,
    nextOffset,
    total: list.length,
  };
}

export function sortSongs(
  songs: ISong[],
  orderBy: SongsOrderByOptions,
  sort: SortOptions,
): ISong[] {
  const isAsc = sort === SortOptions.Asc;

  return [...songs].sort((a, b) => {
    let comparison = 0;

    switch (orderBy) {
      case SongsOrderByOptions.Artist:
        comparison = (a.artist || "").localeCompare(b.artist || "");
        break;
      case SongsOrderByOptions.Title:
        comparison = (a.title || "").localeCompare(b.title || "");
        break;
      case SongsOrderByOptions.Album:
        comparison = (a.album || "").localeCompare(b.album || "");
        break;
      case SongsOrderByOptions.LastAdded:
      default:
        comparison = dateMs(a.created) - dateMs(b.created);
    }

    return isAsc ? comparison : -comparison;
  });
}

export async function getOfflineSongById(
  songId: string,
): Promise<ISong | undefined> {
  const songs = await metadataCache.getSongs();
  return songs.find((song) => song.id === songId);
}

export async function getOfflineFavoriteSongs(): Promise<ISong[]> {
  const songs = await metadataCache.getSongs();
  return songs.filter((song) => song.starred !== undefined);
}

export async function getOfflineRandomSongs(size = 10): Promise<ISong[]> {
  const songs = await metadataCache.getSongs();
  const copy = [...songs];
  const end = Math.min(size, copy.length);

  for (let i = 0; i < end; i += 1) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, end);
}

export async function getOfflineSongCount(): Promise<number> {
  const meta = await metadataCache.getMeta();
  return meta?.songCount ?? 0;
}

export async function searchOfflineSongs({
  query,
  songCount,
  songOffset,
  orderBy = SongsOrderByOptions.LastAdded,
  sort = SortOptions.Desc,
}: OfflineSongSearchParams) {
  const songs = await metadataCache.getSongs();
  const filtered = songs.filter((song) =>
    matchesQuery(
      [
        song.title,
        song.album,
        song.artist,
        song.displayArtist,
        song.displayAlbumArtist,
      ],
      query,
    ),
  );
  const sorted = sortSongs(filtered, orderBy, sort);
  const paged = paginate(sorted, songOffset, songCount);

  return {
    songs: paged.items,
    nextOffset: paged.nextOffset,
  };
}

export async function getOfflineArtistSongs(
  artistId: string,
  orderBy = SongsOrderByOptions.LastAdded,
  sort = SortOptions.Desc,
) {
  const [artist, songs] = await Promise.all([
    metadataCache.getArtistWithAlbums(artistId),
    metadataCache.getSongs(),
  ]);

  if (!artist?.album) {
    return {
      songs: [],
      nextOffset: null,
    };
  }

  const albumIds = new Set(artist.album.map((album) => album.id));
  const artistSongs = songs.filter(
    (song) => song.artistId === artistId || albumIds.has(song.albumId),
  );

  return {
    songs: sortSongs(artistSongs, orderBy, sort),
    nextOffset: null,
  };
}

export async function searchOfflineAlbums({
  query,
  count,
  offset,
}: OfflineAlbumSearchParams) {
  const albums = await metadataCache.getAlbums();
  const filtered = sortAlbumsByName(
    albums.filter((album) =>
      matchesQuery(
        [album.name, album.artist, album.sortName, album.displayArtist],
        query,
      ),
    ),
  );
  const paged = paginate(filtered, offset, count);

  return {
    albums: paged.items,
    nextOffset: paged.nextOffset,
    albumsCount: paged.total,
  };
}

function matchAlbumGenre(album: Albums, genre?: string) {
  if (!genre) return true;

  if (normalize(album.genre) === normalize(genre)) {
    return true;
  }

  return album.genres.some((item) => normalize(item.name) === normalize(genre));
}

function withinYearRange(album: Albums, fromYear?: string, toYear?: string) {
  if (!fromYear || !toYear) return true;
  if (!album.year) return false;

  const min = Math.min(Number(fromYear), Number(toYear));
  const max = Math.max(Number(fromYear), Number(toYear));
  return album.year >= min && album.year <= max;
}

function sortAlbums(albums: Albums[], params: Required<AlbumListParams>) {
  switch (params.type) {
    case AlbumsFilters.ByArtist:
      return [...albums].sort((a, b) =>
        (a.artist || "").localeCompare(b.artist || ""),
      );
    case AlbumsFilters.ByGenre:
    case AlbumsFilters.ByName:
      return sortAlbumsByName(albums);
    case AlbumsFilters.Starred:
      return [...albums]
        .filter((album) => album.starred !== undefined)
        .sort((a, b) => dateMs(b.starred) - dateMs(a.starred));
    case AlbumsFilters.MostPlayed:
      return [...albums].sort(
        (a, b) => (b.playCount ?? 0) - (a.playCount ?? 0),
      );
    case AlbumsFilters.Random:
      return [...albums].sort(() => Math.random() - 0.5);
    case AlbumsFilters.RecentlyPlayed:
      return [...albums]
        .filter((album) => album.played)
        .sort((a, b) => dateMs(b.played) - dateMs(a.played));
    case AlbumsFilters.ByYear: {
      const asc = Number(params.fromYear) <= Number(params.toYear);
      return [...albums]
        .filter((album) =>
          withinYearRange(album, params.fromYear, params.toYear),
        )
        .sort((a, b) => {
          const yearA = a.year ?? (asc ? Infinity : -Infinity);
          const yearB = b.year ?? (asc ? Infinity : -Infinity);
          return asc ? yearA - yearB : yearB - yearA;
        });
    }
    case AlbumsFilters.RecentlyAdded:
    default:
      return [...albums].sort((a, b) => dateMs(b.created) - dateMs(a.created));
  }
}

export async function getOfflineAlbumList(params: Required<AlbumListParams>) {
  const albums = await metadataCache.getAlbums();
  const filtered = albums.filter(
    (album) =>
      matchAlbumGenre(album, params.genre) &&
      (params.type !== AlbumsFilters.ByYear ||
        withinYearRange(album, params.fromYear, params.toYear)),
  );
  const sorted = sortAlbums(filtered, params);
  const paged = paginate(sorted, params.offset, params.size);

  return {
    albumsCount: paged.total,
    list: paged.items,
  };
}

export async function getOfflineArtists() {
  const artists = await metadataCache.getArtists();
  return [...artists].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOfflinePlaylists(): Promise<Playlist[]> {
  return metadataCache.getPlaylists();
}

export async function getOfflineGenres(): Promise<Genre[]> {
  return metadataCache.getGenres();
}

export async function hasOfflineLibrarySync(): Promise<boolean> {
  const meta = await metadataCache.getMeta();
  return Boolean(meta?.lastSyncedAt);
}
