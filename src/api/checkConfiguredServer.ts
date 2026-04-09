import { useAppStore } from "@/store/app.store";
import { appName } from "@/utils/appName";
import { authQueryParams } from "./auth";

export async function checkConfiguredServerConnectivity(): Promise<boolean> {
  try {
    const { url, username, password, authType, protocolVersion } =
      useAppStore.getState().data;

    if (!url || !username || !password || !authType) {
      return false;
    }

    const query = {
      ...authQueryParams(username, password, authType),
      v: protocolVersion || "1.16.0",
      c: appName,
      f: "json",
    };

    const queries = new URLSearchParams(query).toString();
    const response = await fetch(`${url}/rest/ping.view?${queries}`, {
      method: "GET",
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data["subsonic-response"]?.status === "ok";
  } catch {
    return false;
  }
}
