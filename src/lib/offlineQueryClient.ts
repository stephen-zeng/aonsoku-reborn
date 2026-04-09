import { getNetworkStatus } from "@/app/hooks/use-network-status";

/**
 * Wraps a query function to be offline-aware.
 * When in offline mode, uses the offline fallback
 * instead of the network call.
 */
export function offlineAwareQueryFn<T>(
  onlineFn: () => Promise<T>,
  offlineFn: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    if (getNetworkStatus().isOfflineMode) {
      return offlineFn();
    }
    return onlineFn();
  };
}
