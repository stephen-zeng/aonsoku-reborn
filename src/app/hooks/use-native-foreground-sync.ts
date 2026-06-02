import { useEffect } from "react";
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
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}

async function syncOnForeground(
  controller: NonNullable<ReturnType<typeof getNativeQueueController>>,
) {
  await controller.syncFromNative();
}
