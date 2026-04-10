import { useEffect } from "react";
import { useCacheActions, useCacheStore } from "@/store/cache.store";

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

export function useNetworkStatus() {
  const isOnline = useCacheStore((state) => state.status.isOnline);
  const syncLibrary = useCacheStore((state) => state.settings.syncLibrary);

  return {
    isOnline,
    isOfflineMode: syncLibrary && !isOnline,
  };
}

export function getNetworkStatus() {
  const state = useCacheStore.getState();
  return {
    isOnline: state.status.isOnline,
    isOfflineMode: state.settings.syncLibrary && !state.status.isOnline,
  };
}
