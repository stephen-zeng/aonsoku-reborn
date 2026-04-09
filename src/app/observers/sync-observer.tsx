import { useEffect } from "react";
import { metadataCache } from "@/lib/cache/metadata-cache";
import { hydrateFromSyncCache } from "@/lib/sync/sync-hydrator";
import { queryClient } from "@/lib/queryClient";
import { useSyncStore } from "@/store/sync.store";

export function SyncObserver() {
  // Hydrate React Query cache from sync data on launch
  useEffect(() => {
    let cancelled = false;

    async function initAndMaybeSync() {
      const meta = await metadataCache.getMeta();
      if (cancelled) return;

      const { actions, settings, state } = useSyncStore.getState();

      if (meta?.lastSyncedAt) {
        actions.setLastSyncedAt(meta.lastSyncedAt);
        await hydrateFromSyncCache(meta);
      }

      if (settings.syncOnLaunchEnabled && state.status !== "running") {
        actions.startSync();
      }
    }

    initAndMaybeSync();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-hydrate when sync completes
  const status = useSyncStore((s) => s.state.status);

  useEffect(() => {
    if (status === "done") {
      hydrateFromSyncCache();
      // Refresh offline-library-meta so pages see the new lastSyncedAt
      queryClient.invalidateQueries({ queryKey: ["offline-library-meta"] });
    }
  }, [status]);

  return null;
}
