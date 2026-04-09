import { AppRequestError, isReachabilityError } from "@/api/errors";
import { useOfflineStore } from "@/store/offline.store";

export type OfflineReadMode =
  | "online_only"
  | "offline_capable"
  | "cache_warm_only";

export function assertOnlineAccess(
  message = "Operation unavailable while offline",
) {
  if (useOfflineStore.getState().state.isOfflineMode) {
    throw new AppRequestError("network_unreachable", message);
  }
}

export async function readOfflineCapable<T>(
  readOnline: () => Promise<T>,
  readOffline: () => Promise<T>,
): Promise<T> {
  if (useOfflineStore.getState().state.isOfflineMode) {
    return readOffline();
  }

  try {
    return await readOnline();
  } catch (error) {
    if (!isReachabilityError(error)) {
      throw error;
    }

    await useOfflineStore.getState().actions.enterOfflineMode();
    return readOffline();
  }
}

export async function readOnlineOnly<T>(
  readOnline: () => Promise<T>,
  offlineValue: T,
): Promise<T> {
  if (useOfflineStore.getState().state.isOfflineMode) {
    return offlineValue;
  }

  try {
    return await readOnline();
  } catch (error) {
    if (!isReachabilityError(error)) {
      throw error;
    }

    await useOfflineStore.getState().actions.enterOfflineMode();
    return offlineValue;
  }
}
