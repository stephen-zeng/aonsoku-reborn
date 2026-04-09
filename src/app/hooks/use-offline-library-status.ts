import { useQuery } from "@tanstack/react-query";
import { metadataCache } from "@/lib/cache/metadata-cache";
import { useIsOffline } from "@/store/offline.store";

export function useOfflineLibraryStatus() {
  const isOfflineMode = useIsOffline();
  // Always-enabled with a stable key so the snapshot is already loaded when
  // offline mode kicks in, avoiding a flash of the "empty library" state.
  const { data, isLoading } = useQuery({
    queryKey: ["offline-library-meta"],
    queryFn: () => metadataCache.getMeta(),
    staleTime: 0,
    gcTime: 0,
  });

  return {
    isOfflineMode,
    hasSyncedLibrary: Boolean(data?.lastSyncedAt),
    isLoading,
  };
}
