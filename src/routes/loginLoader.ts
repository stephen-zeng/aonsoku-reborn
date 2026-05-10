import { redirect } from "react-router-dom";
import { ROUTES } from "@/routes/routesList";
import { canUseConfiguredSession } from "./configuredSession";

export async function loginLoader() {
  if (await canUseConfiguredSession()) return redirect(ROUTES.LIBRARY.HOME);

  return null;
}
