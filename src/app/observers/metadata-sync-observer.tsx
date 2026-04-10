import { useEffect, useRef } from "react";
import { metadataSyncService } from "@/service/cache";
import { useCacheSettings } from "@/store/cache.store";

export function MetadataSyncObserver() {
  const { syncLibrary, syncCoverArt } = useCacheSettings();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (!syncLibrary) return;

    hasRun.current = true;
    metadataSyncService.syncAll({
      includeCoverArt: syncCoverArt,
    });
  }, [syncLibrary, syncCoverArt]);

  return null;
}
