import { useQuery } from "@tanstack/react-query";
import { subsonic } from "@/service/subsonic";
import { useIsOnline } from "@/store/cache.store";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { queryKeys } from "@/utils/queryKeys";

export const useGetArtist = (artistId: string) =>
  useOfflineQuery(
    [queryKeys.artist.single, artistId],
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

export const useGetArtistInfo = (artistId: string) => {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [queryKeys.artist.info, artistId],
    queryFn: () => subsonic.artists.getInfo(artistId),
    enabled: !!artistId && isOnline,
  });
};

export const useGetTopSongs = (artistName?: string) => {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [queryKeys.artist.topSongs, artistName],
    queryFn: () => subsonic.songs.getTopSongs(artistName ?? ""),
    enabled: !!artistName && isOnline,
  });
};
