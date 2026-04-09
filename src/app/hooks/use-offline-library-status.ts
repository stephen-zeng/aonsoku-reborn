import { useQuery } from "@tanstack/react-query";
import { metadataCache } from "@/lib/cache/metadata-cache";
import { useIsOffline } from "@/store/offline.store";

export function useOfflineLibraryStatus() {
  const isOfflineMode = useIsOffline();
  const { data, isLoading } = useQuery({
    queryKey: ["offline-library-meta", isOfflineMode],
    queryFn: () => metadataCache.getMeta(),
    enabled: isOfflineMode,
    staleTime: 0,
    gcTime: 0,
  });

  return {
    isOfflineMode,
    hasOfflineData: Boolean(data?.lastSyncedAt),
    isLoading: isOfflineMode && isLoading,
  };
}
