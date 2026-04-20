import { checkConfiguredServerConnectivity } from "@/api/checkConfiguredServer";
import { probeServerConnection } from "@/api/pingServer";
import { useAppStore } from "@/store/app.store";

function getConfiguredUrls() {
  const { primaryUrl, fallbackUrl, url } = useAppStore.getState().data;
  return Array.from(
    new Set([primaryUrl, fallbackUrl, url].filter(Boolean)),
  ) as string[];
}

export function hasConfiguredSession() {
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
  const { username, password, authType } = useAppStore.getState().data;

  if (!hasConfiguredSession() || !username || !password || authType === null) {
    return false;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const urls = getConfiguredUrls();
  const probes = await Promise.all(
    urls.map((serverUrl) =>
      probeServerConnection(serverUrl, username, password, authType),
    ),
  );

  if (probes.some((probe) => probe.status === "ok")) {
    await checkConfiguredServerConnectivity();
    return true;
  }

  return probes.some((probe) => probe.status !== "auth_failed");
}
