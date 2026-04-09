import { redirect } from "react-router-dom";
import { ROUTES } from "@/routes/routesList";
import { useAppStore } from "@/store/app.store";

export function protectedLoader() {
  const { url, password, isServerConfigured } = useAppStore.getState().data;
  const hasNoUrl = !url || url === "";
  const hasNoToken = !password || password === "";

  if (hasNoUrl || hasNoToken || !isServerConfigured)
    return redirect(ROUTES.SERVER_CONFIG);

  return null;
}
