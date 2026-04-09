import { redirect } from "react-router-dom";
import { checkConfiguredServerConnectivity } from "@/api/checkConfiguredServer";
import { ROUTES } from "@/routes/routesList";
import { useAppStore } from "@/store/app.store";

export async function loginLoader() {
  const { url, username, password, isServerConfigured } =
    useAppStore.getState().data;

  const hasUrl = Boolean(url && url !== "");
  const hasPassword = Boolean(password && password !== "");
  const hasUser = Boolean(username && username !== "");

  if (hasUrl && hasPassword && hasUser && isServerConfigured) {
    const isServerUp = await checkConfiguredServerConnectivity();
    if (isServerUp) return redirect(ROUTES.LIBRARY.HOME);
  }

  return null;
}
