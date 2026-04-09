import { useEffect, useRef } from "react";
import { metadataSyncService } from "@/service/cache";
import { useCacheSettings } from "@/store/cache.store";

/**
 * Auto-triggers metadata sync on app launch when the user
 * has offline mode enabled with syncOnLaunch = true.
 * Mount once at the app root level.
 */
export function MetadataSyncObserver() {
  const { mode, syncOnLaunch, syncCoverArt } =
    useCacheSettings();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (mode !== "offline" || !syncOnLaunch) return;

    hasRun.current = true;
    metadataSyncService.syncAll({
      includeCoverArt: syncCoverArt,
    });
  }, [mode, syncOnLaunch, syncCoverArt]);

  return null;
}
