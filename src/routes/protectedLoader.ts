import { redirect } from "react-router-dom";
import { checkConfiguredServerConnectivity } from "@/api/checkConfiguredServer";
import { ROUTES } from "@/routes/routesList";
import { useAppStore } from "@/store/app.store";

export async function protectedLoader() {
  const { primaryUrl, url, password, isServerConfigured } =
    useAppStore.getState().data;
  const hasNoUrl = !(primaryUrl || url);
  const hasNoToken = !password || password === "";

  if (hasNoUrl || hasNoToken || !isServerConfigured)
    return redirect(ROUTES.SERVER_CONFIG);

  const isServerUp = await checkConfiguredServerConnectivity();

  if (!isServerUp) return redirect(ROUTES.SERVER_CONFIG);

  return null;
}
