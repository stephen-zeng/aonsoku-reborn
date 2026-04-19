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
      // Empty songs table means the full-songs sync hasn't populated
      // yet (syncLibrary off, fresh install, or mid-sync). Fall back
      // to the network so the count isn't incorrectly reported as 0.
      if (songs.length === 0) return undefined as unknown as number;
      return songs.filter((s) => s.starred != null).length;
    },
  });
}
