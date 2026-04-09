import { useQuery } from "@tanstack/react-query";
import { subsonic } from "@/service/subsonic";
import { queryKeys } from "@/utils/queryKeys";

export const useGetArtist = (artistId: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.single, artistId],
    queryFn: () => subsonic.artists.getOne(artistId),
    enabled: !!artistId,
  });
};

export const useGetArtistInfo = (artistId: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.info, artistId],
    queryFn: () => subsonic.artists.getInfo(artistId),
    enabled: !!artistId,
    // readOnlineOnly service — pause rather than overwrite cache with null offline
    networkMode: "online",
  });
};

export const useGetTopSongs = (artistName?: string) => {
  return useQuery({
    queryKey: [queryKeys.artist.topSongs, artistName],
    queryFn: () => subsonic.songs.getTopSongs(artistName ?? ""),
    enabled: !!artistName,
    // readOnlineOnly service — pause rather than overwrite cache with null offline
    networkMode: "online",
  });
};
