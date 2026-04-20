import { useQuery } from "@tanstack/react-query";
import { subsonic } from "@/service/subsonic";
import { useIsOnline } from "@/store/cache.store";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { type AlbumsListData } from "@/types/responses/album";
import { queryKeys } from "@/utils/queryKeys";

const GENRE_PREVIEW_LIMIT = 16;

export const useGetAlbum = (albumId: string) =>
  useOfflineQuery(
    [...queryKeys.album.single, albumId],
    () => subsonic.albums.getOne(albumId),
    {
      enabled: !!albumId,
      offlineFn: async () => {
        const albums = await offlineData.albums();
        const album = albums.find((a) => a.id === albumId);
        if (!album) throw new Error(`Album ${albumId} not found offline`);
        return album;
      },
    },
  );

export const useGetAlbumInfo = (albumId: string) => {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [...queryKeys.album.info, albumId],
    queryFn: () => subsonic.albums.getInfo(albumId),
    enabled: !!albumId && isOnline,
  });
};

export const useGetArtistAlbums = (artistId: string) =>
  useOfflineQuery(
    [...queryKeys.album.moreAlbums, artistId],
    () => subsonic.artists.getOne(artistId),
    {
      enabled: !!artistId,
      offlineFn: async () => {
        const artists = await offlineData.artists();
        const artist = artists.find((a) => a.id === artistId);
        if (!artist) throw new Error(`Artist ${artistId} not found offline`);
        return artist;
      },
    },
  );

export const useGetGenreAlbums = (genre: string) =>
  useOfflineQuery(
    [...queryKeys.album.genreAlbums, genre],
    () => subsonic.albums.getAlbumList({ type: "byGenre", genre, size: 16 }),
    {
      enabled: !!genre,
      offlineFn: async (): Promise<AlbumsListData> => {
        const albums = await offlineData.albums();
        const filtered = albums
          .filter((album) => album.genre === genre)
          .slice(0, GENRE_PREVIEW_LIMIT);

        return {
          list: filtered,
          albumsCount: filtered.length,
        };
      },
    },
  );
