import { redirect } from "react-router-dom";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { useAppStore } from "@/store/app.store";
import { useOfflineStore } from "@/store/offline.store";

export async function protectedLoader() {
  const { url, password, isServerConfigured } = useAppStore.getState().data;
  const hasNoUrl = !url || url === "";
  const hasNoToken = !password || password === "";

  if (hasNoUrl || hasNoToken || !isServerConfigured)
    return redirect(ROUTES.SERVER_CONFIG);

  // If already in offline mode, skip ping
  if (useOfflineStore.getState().state.isOfflineMode) return null;

  const isServerUp = await subsonic.ping.pingView();
  if (!isServerUp) {
    // Server unreachable but credentials exist — enter offline mode
    await useOfflineStore.getState().actions.enterOfflineMode();
    return null;
  }

  return null;
}
