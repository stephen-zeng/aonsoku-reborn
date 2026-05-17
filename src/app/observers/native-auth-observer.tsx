import { useEffect } from "react";
import { AonsokuNativeBridge } from "@aonsoku/native-bridge";
import { useAppStore } from "@/store/app.store";
import { AuthType } from "@/types/serverConfig";
import { getRuntime } from "@/utils/capabilities";

export function NativeAuthObserver() {
  useEffect(() => {
    if (getRuntime() !== "capacitor-ios") return;

    AonsokuNativeBridge.getCredentials()
      .then((credentials) => {
        if (!credentials || !credentials.serverUrl) return;

        useAppStore.setState((state) => {
          state.data.url = credentials.serverUrl;
          state.data.primaryUrl = credentials.serverUrl;
          state.data.fallbackUrl = credentials.fallbackUrl ?? "";
          state.data.activeServerType = "primary";
          state.data.username = credentials.username;
          state.data.password = "";
          state.data.authType =
            credentials.authType === "token"
              ? AuthType.TOKEN
              : AuthType.PASSWORD;
          state.data.protocolVersion = credentials.protocolVersion;
          state.data.serverType = credentials.serverType;
          state.data.isServerConfigured = true;
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
