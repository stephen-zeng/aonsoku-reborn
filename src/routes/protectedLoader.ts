import { redirect } from "react-router-dom";
import { checkConfiguredServerConnectivity } from "@/api/checkConfiguredServer";
import { ROUTES } from "@/routes/routesList";
import { useAppStore } from "@/store/app.store";
import { useOfflineStore } from "@/store/offline.store";

const OFFLINE_RECONNECT_COOLDOWN_MS = 15 * 1000;

export async function protectedLoader() {
  const { url, password, isServerConfigured } = useAppStore.getState().data;
  const hasNoUrl = !url || url === "";
  const hasNoToken = !password || password === "";

  if (hasNoUrl || hasNoToken || !isServerConfigured)
    return redirect(ROUTES.SERVER_CONFIG);

  const { state, actions } = useOfflineStore.getState();

  if (state.isOfflineMode) {
    const shouldRetry =
      state.lastConnectivityCheckAt === null ||
      Date.now() - state.lastConnectivityCheckAt >=
        OFFLINE_RECONNECT_COOLDOWN_MS;

    if (shouldRetry) {
      await actions.tryReconnect();
    }

    return null;
  }

  const isServerUp = await checkConfiguredServerConnectivity();
  if (!isServerUp) {
    await actions.enterOfflineMode();
    return null;
  }

  return null;
}
