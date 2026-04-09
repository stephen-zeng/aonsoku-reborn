import { useEffect } from "react";
import { useCacheActions, useCacheStore } from "@/store/cache.store";

/**
 * Hook that monitors network status and updates the cache store.
 * Should be mounted once at the app root level.
 */
export function useNetworkStatusObserver() {
  const { setIsOnline } = useCacheActions();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setIsOnline]);
}

/**
 * Hook to read current network status.
 */
export function useNetworkStatus() {
  const isOnline = useCacheStore(
    (state) => state.status.isOnline,
  );
  const mode = useCacheStore((state) => state.settings.mode);

  return {
    isOnline,
    isOfflineMode: mode === "offline" && !isOnline,
  };
}

/**
 * Non-hook version for use in services.
 */
export function getNetworkStatus() {
  const state = useCacheStore.getState();
  return {
    isOnline: state.status.isOnline,
    isOfflineMode:
      state.settings.mode === "offline" &&
      !state.status.isOnline,
  };
}
