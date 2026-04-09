import {
  getOfflineArtistSongs,
  searchOfflineSongs,
  sortSongs,
} from "@/lib/offline/library-read-model";
import { readOfflineCapable } from "@/lib/offline/read-model";
import { SearchQueryOptions } from "@/service/search";
import { subsonic } from "@/service/subsonic";
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

// Cache for all songs is removed as we are switching to server-side pagination for "All Songs"

export async function songsSearch(params: SongSearchParams) {
  const orderBy = params.orderBy || SongsOrderByOptions.LastAdded;
  const sort = params.sort || SortOptions.Desc;

  return readOfflineCapable(
    async () => {
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
    },
    () =>
      searchOfflineSongs({
        query: params.query,
        songCount: params.songCount,
        songOffset: params.songOffset,
        orderBy,
        sort,
      }),
  );
}

export async function getArtistAllSongs(
  artistId: string,
  params: ArtistSongsParams = {},
) {
  const orderBy = params.orderBy || SongsOrderByOptions.LastAdded;
  const sort = params.sort || SortOptions.Desc;

  return readOfflineCapable(
    async () => {
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
    },
    () => getOfflineArtistSongs(artistId, orderBy, sort),
  );
}

export async function getFavoriteSongs() {
  const response = await subsonic.songs.getFavoriteSongs();
  if (!response || !response.song) return { songs: [], nextOffset: null };

  return {
    songs: response.song,
    nextOffset: null,
  };
}
