import { useQuery } from "@tanstack/react-query";
import { subsonic } from "@/service/subsonic";
import { useIsOffline } from "@/store/offline.store";
import { queryKeys } from "@/utils/queryKeys";

export const useGetArtist = (artistId: string) => {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.artist.single, artistId, isOfflineMode],
    queryFn: () => subsonic.artists.getOne(artistId),
    enabled: !!artistId,
  });
};

export const useGetArtistInfo = (artistId: string) => {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.artist.info, artistId, isOfflineMode],
    queryFn: () => subsonic.artists.getInfo(artistId),
    enabled: !!artistId,
  });
};

export const useGetTopSongs = (artistName?: string) => {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.artist.topSongs, artistName, isOfflineMode],
    queryFn: () => subsonic.songs.getTopSongs(artistName ?? ""),
    enabled: !!artistName,
  });
};
