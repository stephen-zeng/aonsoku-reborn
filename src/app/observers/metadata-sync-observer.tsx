import { useEffect, useRef } from "react";
import { getNetworkStatus } from "@/app/hooks/use-network-status";
import { syncService } from "@/service/cache/sync-worker-adapter";
import {
  useCacheStore,
  useIsMetered,
  useIsOnline,
  useLibraryCaching,
} from "@/store/cache.store";

const FOCUS_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Fire-and-forget startup + focus sync.
 *
 *   - On mount (once per session): run a full sync, but only when
 *     library caching is enabled. This populates IDB on fresh
 *     installs and catches deletions on every cold start.
 *   - When `libraryCaching` switches from false → true: trigger a
 *     full initial sync so the library is populated immediately.
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
 * for offline caching. When `libraryCaching` is false, no sync
 * runs at all — the app stays in pure online mode.
 */
export function MetadataSyncObserver() {
  const libraryCaching = useLibraryCaching();
  const syncLibrary = useCacheStore((s) => s.settings.syncLibrary);
  const syncCoverArt = useCacheStore((s) => s.settings.syncCoverArt);
  const isOnline = useIsOnline();
  const isMetered = useIsMetered();
  const hasRun = useRef(false);
  const lastFocusSyncAt = useRef(0);
  const prevLibraryCaching = useRef(libraryCaching);

  useEffect(() => {
    if (!libraryCaching || !isOnline || isMetered) return;

    const justEnabled = !prevLibraryCaching.current;
    prevLibraryCaching.current = true;

    if (!hasRun.current) {
      hasRun.current = true;
      lastFocusSyncAt.current = Date.now();
      syncService.syncAll({
        includeCoverArt: syncCoverArt,
        includeFullSongs: syncLibrary,
      });
    } else if (justEnabled) {
      lastFocusSyncAt.current = Date.now();
      syncService.syncAll({
        includeCoverArt: syncCoverArt,
        includeFullSongs: syncLibrary,
      });
    }
  }, [libraryCaching, syncLibrary, syncCoverArt, isOnline, isMetered]);

  useEffect(() => {
    if (!libraryCaching) {
      prevLibraryCaching.current = false;
    }
  }, [libraryCaching]);

  useEffect(() => {
    const handleFocus = () => {
      const { isOnline } = getNetworkStatus();
      const state = useCacheStore.getState();
      if (!state.settings.libraryCaching) return;
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