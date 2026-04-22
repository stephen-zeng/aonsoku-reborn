import { useEffect, useRef } from "react";
import { smartDownloadEngine } from "@/service/cache";
import {
  useCacheStore,
  useIsMetered,
  useIsOnline,
  useLibraryCaching,
} from "@/store/cache.store";

/**
 * Runs the SmartDownloadEngine on app startup and whenever the user
 * tweaks their smart-download rules. Also re-runs after every sync
 * (via a subscription to `syncState.phase === "done"`) so freshly
 * synced play counts, favorites, and playlist changes feed the
 * matching pass.
 *
 * Skips entirely when libraryCaching is disabled — smart downloads
 * are a form of background caching and don't make sense in pure
 * online mode.
 *
 * Metered / offline states skip the recompute: the engine would only
 * end up queueing new downloads the user can't afford on their
 * current connection. Eviction passes are also skipped so we never
 * delete a smart-cached song because we couldn't reach the server
 * to reconsider playlist entries.
 */
export function SmartDownloadObserver() {
  const rules = useCacheStore((s) => s.settings.smartRules);
  const libraryCaching = useLibraryCaching();
  const isOnline = useIsOnline();
  const isMetered = useIsMetered();
  const lastRunSignature = useRef<string>("");

  useEffect(() => {
    if (!libraryCaching || !isOnline || isMetered) return;

    const signature = JSON.stringify(rules);
    if (signature === lastRunSignature.current) {
      // Initial mount or rules unchanged since last run. Still run
      // once per mount to handle the "sync happened while we were
      // away" case.
      if (lastRunSignature.current !== "") return;
    }
    lastRunSignature.current = signature;
    smartDownloadEngine.recomputeMatches();
  }, [rules, libraryCaching, isOnline, isMetered]);

  useEffect(() => {
    if (!libraryCaching) return;
    const unsub = useCacheStore.subscribe((state, prev) => {
      if (!isOnline || isMetered) return;
      if (
        state.status.syncState.phase === "done" &&
        prev.status.syncState.phase !== "done"
      ) {
        smartDownloadEngine.recomputeMatches();
      }
    });
    return unsub;
  }, [libraryCaching, isOnline, isMetered]);

  return null;
}
