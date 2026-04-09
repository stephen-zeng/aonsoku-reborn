import { useQuery } from "@tanstack/react-query";
import { subsonic } from "@/service/subsonic";
import { useIsOffline } from "@/store/offline.store";
import { queryKeys } from "@/utils/queryKeys";

export const useGetAlbum = (albumId: string) => {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.album.single, albumId, isOfflineMode],
    queryFn: () => subsonic.albums.getOne(albumId),
    enabled: !!albumId,
  });
};

export const useGetAlbumInfo = (albumId: string) => {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.album.info, albumId, isOfflineMode],
    queryFn: () => subsonic.albums.getInfo(albumId),
    enabled: !!albumId,
  });
};

export const useGetArtistAlbums = (artistId: string) => {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.album.moreAlbums, artistId, isOfflineMode],
    queryFn: () => subsonic.artists.getOne(artistId),
    enabled: !!artistId,
  });
};

export const useGetGenreAlbums = (genre: string) => {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.album.genreAlbums, genre, isOfflineMode],
    queryFn: () =>
      subsonic.albums.getAlbumList({
        type: "byGenre",
        genre,
        size: 16,
      }),
    enabled: !!genre,
  });
};
