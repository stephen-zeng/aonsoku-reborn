import { useQuery } from "@tanstack/react-query";
import { metadataCache } from "@/lib/cache/metadata-cache";
import { subsonic } from "@/service/subsonic";
import { useOfflineStore } from "@/store/offline.store";
import { queryKeys } from "@/utils/queryKeys";

export const useGetArtist = (artistId: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.single, artistId],
    queryFn: async () => {
      const isOffline =
        useOfflineStore.getState().state.isOfflineMode;

      if (!isOffline) {
        return subsonic.artists.getOne(artistId);
      }

      return metadataCache.getArtistWithAlbums(artistId);
    },
    enabled: !!artistId,
  });
};

export const useGetArtistInfo = (artistId: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.info, artistId],
    queryFn: () => subsonic.artists.getInfo(artistId),
    enabled: !!artistId,
  });
};

export const useGetTopSongs = (artistName?: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.topSongs, artistName],
    queryFn: () => subsonic.songs.getTopSongs(artistName ?? ""),
    enabled: !!artistName,
  });
};
