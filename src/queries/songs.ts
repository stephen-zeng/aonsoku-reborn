import { SearchQueryOptions } from "@/service/search";
import { subsonic } from "@/service/subsonic";
import { ISong } from "@/types/responses/song";
import { SongsOrderByOptions, SortOptions } from "@/utils/albumsFilter";

const emptyResponse = { songs: [], nextOffset: null };

type SongSearchParams = Required<
  Pick<SearchQueryOptions, "query" | "songCount" | "songOffset">
> & {
  orderBy?: SongsOrderByOptions;
  sort?: SortOptions;
};

interface ArtistSongsParams {
  orderBy?: SongsOrderByOptions;
  sort?: SortOptions;
}

function sortSongs(
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
      default: {
        const dateA = a.created ? new Date(a.created).getTime() || 0 : 0;
        const dateB = b.created ? new Date(b.created).getTime() || 0 : 0;
        comparison = dateA - dateB;
      }
    }

    return isAsc ? comparison : -comparison;
  });
}

export async function songsSearch(params: SongSearchParams) {
  const orderBy = params.orderBy || SongsOrderByOptions.LastAdded;
  const sort = params.sort || SortOptions.Desc;

  const response = await subsonic.search.get({
    artistCount: 0,
    albumCount: 0,
    query: params.query,
    songCount: params.songCount,
    songOffset: params.songOffset,
  });

  if (!response?.song) return emptyResponse;

  const sortedSongs = sortSongs(response.song, orderBy, sort);

  let nextOffset = null;
  if (sortedSongs.length >= params.songCount) {
    nextOffset = params.songOffset + params.songCount;
  }

  return {
    songs: sortedSongs,
    nextOffset,
  };
}

export async function getArtistAllSongs(
  artistId: string,
  params: ArtistSongsParams = {},
) {
  const orderBy = params.orderBy || SongsOrderByOptions.LastAdded;
  const sort = params.sort || SortOptions.Desc;

  const artist = await subsonic.artists.getOne(artistId);

  if (!artist?.album) return emptyResponse;

  const results = await Promise.all(
    artist.album.map((a) => subsonic.albums.getOne(a.id)),
  );

  const songs = results.flatMap((result) => {
    if (!result) return [];

    return result.song;
  });

  return {
    songs: sortSongs(songs, orderBy, sort),
    nextOffset: null,
  };
}

export async function getFavoriteSongs() {
  const response = await subsonic.songs.getFavoriteSongs();
  if (!response || !response.song) return { songs: [], nextOffset: null };

  return {
    songs: response.song,
    nextOffset: null,
  };
}
