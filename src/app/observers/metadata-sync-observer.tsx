import { useEffect, useRef } from "react";
import { getNetworkStatus } from "@/app/hooks/use-network-status";
import { syncService } from "@/service/cache/sync-worker-adapter";
import { useCacheStore, useIsOnline } from "@/store/cache.store";

const FOCUS_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Fire-and-forget startup + focus sync.
 *
 *   - On mount (once per session): run a full sync. This populates
 *     IDB on fresh installs and catches deletions on every cold
 *     start.
 *   - On `window.focus` after the user has been away: run an
 *     incremental sync, throttled to at most one run per 5 minutes
 *     so tabbing back and forth doesn't hammer the server. Each
 *     tier's own fresh window (P3.2) further dampens the work.
 *
 * Both paths skip when offline, on a metered/slow connection
 * (P6.1 — user-initiated sync via the settings refresh button is
 * still allowed), or while a sync is already running. The
 * full-songs T3 step is gated by the `syncLibrary` setting; the
 * toggle is now a "include all songs" switch rather than an on/off
 * for offline caching.
 */
export function MetadataSyncObserver() {
  const syncLibrary = useCacheStore((s) => s.settings.syncLibrary);
  const syncCoverArt = useCacheStore((s) => s.settings.syncCoverArt);
  const isOnline = useIsOnline();
  const isMetered = useCacheStore((s) => s.status.isMetered);
  const hasRun = useRef(false);
  const lastFocusSyncAt = useRef(0);

  useEffect(() => {
    if (hasRun.current) return;
    if (!isOnline) return;
    if (isMetered) return;

    hasRun.current = true;
    lastFocusSyncAt.current = Date.now();
    syncService.syncAll({
      includeCoverArt: syncCoverArt,
      includeFullSongs: syncLibrary,
    });
  }, [syncLibrary, syncCoverArt, isOnline, isMetered]);

  useEffect(() => {
    const handleFocus = () => {
      const { isOnline } = getNetworkStatus();
      const state = useCacheStore.getState();
      if (!isOnline) return;
      if (state.status.isMetered) return;
      if (state.status.syncState.isSyncing) return;

      const now = Date.now();
      if (now - lastFocusSyncAt.current < FOCUS_THROTTLE_MS) return;
      lastFocusSyncAt.current = now;

      syncService.syncIncremental({
        includeCoverArt: state.settings.syncCoverArt,
        includeFullSongs: state.settings.syncLibrary,
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  return null;
}
