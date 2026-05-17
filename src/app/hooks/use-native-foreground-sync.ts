import { useEffect } from "react";
import { getQueueController } from "@/player/queue-controller";
import { NativeQueueController } from "@/player/queue-controller/native-controller";
import { getRuntime } from "@/utils/capabilities";

export function useNativeForegroundSync() {
  useEffect(() => {
    if (getRuntime() !== "capacitor-ios") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncOnForeground();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}

async function syncOnForeground() {
  const controller = getQueueController();
  if (controller instanceof NativeQueueController) {
    await controller.syncFromNative();
  }
}
