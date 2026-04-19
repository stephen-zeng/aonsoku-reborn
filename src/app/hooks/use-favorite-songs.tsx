import { subsonic } from "@/service/subsonic";
import { useAppStore } from "@/store/app.store";
import { convertMinutesToMs } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";

async function fetchFavorites() {
  const response = await subsonic.songs.getFavoriteSongs();
  return response?.song ?? [];
}

async function fetchTotalFavorites(): Promise<number> {
  const storedFavoriteCount = useAppStore.getState().data.favoriteCount;
  if (storedFavoriteCount && storedFavoriteCount > 0) {
    return storedFavoriteCount;
  }
  const songs = await fetchFavorites();
  return songs.length;
}

export function useTotalFavorites() {
  return useOfflineQuery([...queryKeys.favorites.count], fetchTotalFavorites, {
    staleTime: convertMinutesToMs(5),
    offlineFn: async () => {
      const songs = await offlineData.songs();
      return songs.filter((s) => s.starred != null).length;
    },
  });
}
