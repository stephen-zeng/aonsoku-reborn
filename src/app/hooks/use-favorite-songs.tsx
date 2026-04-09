import { useQuery } from "@tanstack/react-query";
import { getOfflineFavoriteSongs } from "@/lib/offline/library-read-model";
import { subsonic } from "@/service/subsonic";
import { useAppStore } from "@/store/app.store";
import { useIsOffline } from "@/store/offline.store";
import { convertMinutesToMs } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";

async function fetchFavorites() {
  const response = await subsonic.songs.getFavoriteSongs();
  return response?.song ?? [];
}

async function fetchTotalFavorites(isOfflineMode: boolean) {
  if (isOfflineMode) {
    const songs = await getOfflineFavoriteSongs();
    return songs.length;
  }

  const storedFavoriteCount = useAppStore.getState().data.favoriteCount;

  if (storedFavoriteCount && storedFavoriteCount > 0) {
    return storedFavoriteCount;
  }
  const songs = await fetchFavorites();
  return songs.length;
}

export function useTotalFavorites() {
  const isOfflineMode = useIsOffline();

  return useQuery({
    queryKey: [queryKeys.favorites.count, isOfflineMode],
    queryFn: () => fetchTotalFavorites(isOfflineMode),
    staleTime: convertMinutesToMs(5),
    gcTime: convertMinutesToMs(5),
  });
}
