import { useMemo } from "react";
import { useOfflineStore } from "@/store/offline.store";

export function useIsSongUnavailable(songId: string, dataType?: string) {
  const isOfflineMode = useOfflineStore((ctx) => ctx.state.isOfflineMode);
  const cachedSongIds = useOfflineStore((ctx) => ctx.state.cachedSongIds);

  return useMemo(() => {
    if (!isOfflineMode || dataType !== "song") return false;
    return cachedSongIds[songId] !== true;
  }, [isOfflineMode, cachedSongIds, dataType, songId]);
}
