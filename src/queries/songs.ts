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

  return songs.sort((a, b) => {
    let comparison = 0;

    switch (orderBy) {
      case SongsOrderByOptions.LastAdded:
        comparison =
          new Date(a.created).getTime() - new Date(b.created).getTime();
        break;
      case SongsOrderByOptions.Artist:
        comparison = (a.artist || "").localeCompare(b.artist || "");
        break;
      case SongsOrderByOptions.Title:
        comparison = (a.title || "").localeCompare(b.title || "");
        break;
      case SongsOrderByOptions.Album:
        comparison = (a.album || "").localeCompare(b.album || "");
        break;
      default:
        comparison =
          new Date(a.created).getTime() - new Date(b.created).getTime();
    }

    return isAsc ? comparison : -comparison;
  });
}

// Cache for all songs is removed as we are switching to server-side pagination for "All Songs"

export async function songsSearch(params: SongSearchParams) {
  const orderBy = params.orderBy || SongsOrderByOptions.LastAdded;
  const sort = params.sort || SortOptions.Desc;

  // Use server-side pagination for both search and "all songs" (empty query)
  // We effectively treat "browse all" as a search with empty query
  const response = await subsonic.search.get({
    artistCount: 0,
    albumCount: 0,
    // If query is empty strings, subsonic service handles whether to send "" or '""' based on server type
    query: params.query,
    songCount: params.songCount,
    songOffset: params.songOffset,
  });

  if (!response) return emptyResponse;
  if (!response.song) return emptyResponse;

  // Note: We are no longer sorting on the client side for the full list because we only fetch a page.
  // Ideally, the server should handle sorting, but search3 might not support it.
  // We return the songs as is from the server for the current page.
  // If we really wanted to sort the *page* we could call sortSongs here, but sorting a single page
  // without the full context can be misleading (e.g. "A" might be on page 2 if server returns random order).
  // However, for consistency with existing search behavior (which sorted the search results),
  // we can keep sorting the returned page if it helps, but generally server order is best for pagination.

  // existing code did: const sortedSongs = sortSongs(response.song, orderBy, sort);
  // We will respect that behavior for the returned page to ensure the types and assumed stability match,
  // although its effectiveness is limited to the page size.
  const sortedSongs = sortSongs(response.song, orderBy, sort);

  let nextOffset = null;
  // If we got a full page, assume there might be more
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

  if (!artist || !artist.album) return emptyResponse;

  const results = await Promise.all(
    artist.album.map((a) => subsonic.albums.getOne(a.id)),
  );

  const songs = results.flatMap((result) => {
    if (!result) return [];

    return result.song;
  });

  // Sort by the selected criteria
  const sortedSongs = sortSongs(songs, orderBy, sort);

  return {
    songs: sortedSongs,
    nextOffset: null,
  };
}

export async function getFavoriteSongs() {
  const response = await subsonic.songs.getFavoriteSongs();
  console.log(response);
  if (!response || !response.song) return { songs: [], nextOffset: null };

  return {
    songs: response.song,
    nextOffset: null,
  };
}
