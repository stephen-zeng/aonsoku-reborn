import { useEffect, useRef } from "react";
import { metadataSyncService } from "@/service/cache";
import { useCacheStore, useIsOnline } from "@/store/cache.store";

/**
 * Fire-and-forget startup sync. Runs the metadata sync (artists /
 * albums / playlists / genres) unconditionally when the user is
 * online. The full-songs sync step is gated by the `syncLibrary`
 * setting, which is now a "include all songs" toggle rather than
 * an on/off switch for offline caching.
 */
export function MetadataSyncObserver() {
  const syncLibrary = useCacheStore((s) => s.settings.syncLibrary);
  const syncCoverArt = useCacheStore((s) => s.settings.syncCoverArt);
  const isOnline = useIsOnline();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    if (!isOnline) return;

    hasRun.current = true;
    metadataSyncService.syncAll({
      includeCoverArt: syncCoverArt,
      includeFullSongs: syncLibrary,
    });
  }, [syncLibrary, syncCoverArt, isOnline]);

  return null;
}
