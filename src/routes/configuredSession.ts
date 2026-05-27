import { checkConfiguredServerConnectivity } from "@/api/checkConfiguredServer";
import { probeServerConnection } from "@/api/pingServer";
import { getConfiguredUrls } from "@/app/hooks/use-network-status";
import { useAppStore } from "@/store/app.store";
import { getRuntime } from "@/utils/capabilities";

export function hasConfiguredSession() {
  if (getRuntime() === "capacitor-ios") {
    const { isServerConfigured } = useAppStore.getState().data;
    return isServerConfigured;
  }

  const { primaryUrl, url, username, password, authType, isServerConfigured } =
    useAppStore.getState().data;

  return Boolean(
    (primaryUrl || url) &&
      username &&
      password &&
      authType !== null &&
      isServerConfigured,
  );
}

export async function canUseConfiguredSession() {
  if (getRuntime() === "capacitor-ios") {
    return hasConfiguredSession();
  }

  const { username, password, authType } = useAppStore.getState().data;

  if (!hasConfiguredSession() || !username || !password || authType === null) {
    return false;
  }

  const urls = getConfiguredUrls();
  const probes = await Promise.all(
    urls.map((serverUrl) =>
      probeServerConnection(serverUrl, username, password, authType),
    ),
  ).catch(() => urls.map(() => ({ status: "network_unreachable" as const })));

  if (probes.some((probe) => probe.status === "ok")) {
    await checkConfiguredServerConnectivity();
    return true;
  }

  return probes.some((probe) => probe.status !== "auth_failed");
}
