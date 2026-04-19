import { useQuery } from "@tanstack/react-query";
import { subsonic } from "@/service/subsonic";
import { useIsOnline } from "@/store/cache.store";
import { convertMinutesToMs } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";

export const useGetRandomSongs = () => {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [...queryKeys.song.random],
    queryFn: () => subsonic.songs.getRandomSongs({ size: 10 }),
    enabled: isOnline,
  });
};

export const useGetRecentlyAdded = () =>
  useOfflineQuery(
    [...queryKeys.album.recentlyAdded],
    () => subsonic.albums.getAlbumList({ size: 16, type: "newest" }),
    { offlineFn: offlineData.albums },
  );

export const useGetMostPlayed = () =>
  useOfflineQuery(
    [...queryKeys.album.mostPlayed],
    () => subsonic.albums.getAlbumList({ size: 16, type: "frequent" }),
    { offlineFn: offlineData.albums },
  );

export const useGetRecentlyPlayed = () => {
  const isOnline = useIsOnline();

  return useOfflineQuery(
    [...queryKeys.album.recentlyPlayed],
    () => subsonic.albums.getAlbumList({ size: 16, type: "recent" }),
    {
      offlineFn: offlineData.albums,
      refetchInterval: isOnline ? convertMinutesToMs(2) : false,
    },
  );
};

export const useGetRandomAlbums = () =>
  useOfflineQuery(
    [...queryKeys.album.random],
    () => subsonic.albums.getAlbumList({ size: 16, type: "random" }),
    { offlineFn: offlineData.albums },
  );
