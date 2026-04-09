import { useQuery } from "@tanstack/react-query";
import { getOfflineFavoriteSongs } from "@/lib/offline/library-read-model";
import { readOfflineCapable } from "@/lib/offline/read-model";
import { subsonic } from "@/service/subsonic";
import { useAppStore } from "@/store/app.store";
import { convertMinutesToMs } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";

async function fetchFavorites() {
  const response = await subsonic.songs.getFavoriteSongs();
  return response?.song ?? [];
}

async function fetchTotalFavorites(): Promise<number> {
  return readOfflineCapable(
    async () => {
      const storedFavoriteCount = useAppStore.getState().data.favoriteCount;
      if (storedFavoriteCount && storedFavoriteCount > 0) {
        return storedFavoriteCount;
      }
      const songs = await fetchFavorites();
      return songs.length;
    },
    async () => {
      const songs = await getOfflineFavoriteSongs();
      return songs.length;
    },
  );
}

export function useTotalFavorites() {
  return useQuery({
    queryKey: [queryKeys.favorites.count],
    queryFn: fetchTotalFavorites,
    staleTime: convertMinutesToMs(5),
    gcTime: convertMinutesToMs(5),
  });
}
