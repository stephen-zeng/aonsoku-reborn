import { useEffect, useRef } from "react";
import { metadataSyncService } from "@/service/cache";
import { useCacheStore, useIsOnline } from "@/store/cache.store";

export function MetadataSyncObserver() {
  const syncLibrary = useCacheStore((s) => s.settings.syncLibrary);
  const syncCoverArt = useCacheStore((s) => s.settings.syncCoverArt);
  const isOnline = useIsOnline();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (!syncLibrary) return;
    if (!isOnline) return;

    hasRun.current = true;
    metadataSyncService.syncAll({
      includeCoverArt: syncCoverArt,
    });
  }, [syncLibrary, syncCoverArt, isOnline]);

  return null;
}
