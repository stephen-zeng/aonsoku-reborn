import { useEffect } from "react";
import { metadataCache } from "@/lib/cache/metadata-cache";
import { useSyncStore } from "@/store/sync.store";

export function SyncObserver() {
  useEffect(() => {
    let cancelled = false;

    async function initAndMaybeSync() {
      const meta = await metadataCache.getMeta();
      if (cancelled) return;

      const { actions, settings, state } = useSyncStore.getState();

      if (meta?.lastSyncedAt) {
        actions.setLastSyncedAt(meta.lastSyncedAt);
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

  return null;
}
