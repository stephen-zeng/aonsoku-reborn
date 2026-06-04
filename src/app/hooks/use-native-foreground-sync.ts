import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { getNativeQueueController } from "@/player/queue-controller";

export function useNativeForegroundSync() {
  useEffect(() => {
    const controller = getNativeQueueController();
    if (!controller) return;

    syncOnForeground(controller);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncOnForeground(controller);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    let appStateHandle: Promise<PluginListenerHandle> | null = null;
    if (Capacitor.isNativePlatform()) {
      appStateHandle = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          syncOnForeground(controller);
        }
      });
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (appStateHandle) {
        appStateHandle.then((h) => h.remove());
      }
    };
  }, []);
}

async function syncOnForeground(
  controller: NonNullable<ReturnType<typeof getNativeQueueController>>,
) {
  await controller.syncFromNative();
}
