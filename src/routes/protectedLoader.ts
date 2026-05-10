import { redirect } from "react-router-dom";
import { ROUTES } from "@/routes/routesList";
import { canUseConfiguredSession } from "./configuredSession";

export async function protectedLoader() {
  if (await canUseConfiguredSession()) return null;

  return redirect(ROUTES.SERVER_CONFIG);
}
