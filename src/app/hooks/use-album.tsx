import { useQuery } from "@tanstack/react-query";
import { metadataCache } from "@/lib/cache/metadata-cache";
import { subsonic } from "@/service/subsonic";
import { useOfflineStore } from "@/store/offline.store";
import { queryKeys } from "@/utils/queryKeys";

export const useGetAlbum = (albumId: string) => {
  return useQuery({
    queryKey: [queryKeys.album.single, albumId],
    queryFn: async () => {
      const isOffline =
        useOfflineStore.getState().state.isOfflineMode;

      if (!isOffline) {
        return subsonic.albums.getOne(albumId);
      }

      return metadataCache.getAlbumWithSongs(albumId);
    },
    enabled: !!albumId,
  });
};

export const useGetAlbumInfo = (albumId: string) => {
  return useQuery({
    queryKey: [queryKeys.album.info, albumId],
    queryFn: () => subsonic.albums.getInfo(albumId),
    enabled: !!albumId,
  });
};

export const useGetArtistAlbums = (artistId: string) => {
  return useQuery({
    queryKey: [queryKeys.album.moreAlbums, artistId],
    queryFn: () => subsonic.artists.getOne(artistId),
    enabled: !!artistId,
  });
};

export const useGetGenreAlbums = (genre: string) => {
  return useQuery({
    queryKey: [queryKeys.album.genreAlbums, genre],
    queryFn: () =>
      subsonic.albums.getAlbumList({
        type: "byGenre",
        genre,
        size: 16,
      }),
    enabled: !!genre,
  });
};
