import { useQuery } from "@tanstack/react-query";
import { getOfflineArtistDetail, useOfflineQuery } from "@/lib/offlineQueryClient";
import { subsonic } from "@/service/subsonic";
import { useIsOnline } from "@/store/cache.store";
import { queryKeys } from "@/utils/queryKeys";

export const useGetArtist = (artistId: string) =>
  useOfflineQuery(
    [...queryKeys.artist.single, artistId],
    () => subsonic.artists.getOne(artistId),
    {
      enabled: !!artistId,
      offlineFn: () => getOfflineArtistDetail(artistId),
    },
  );

export const useGetArtistInfo = (artistId: string) => {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [...queryKeys.artist.info, artistId],
    queryFn: () => subsonic.artists.getInfo(artistId),
    enabled: !!artistId && isOnline,
  });
};

export const useGetTopSongs = (artistName?: string) => {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [...queryKeys.artist.topSongs, artistName],
    queryFn: () => subsonic.songs.getTopSongs(artistName ?? ""),
    enabled: !!artistName && isOnline,
  });
};
