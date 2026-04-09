import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useOfflineStore } from "@/store/offline.store";

export function OfflineObserver() {
  const { t } = useTranslation();

  useEffect(() => {
    async function handleOffline() {
      const { state, actions } = useOfflineStore.getState();
      if (state.isOfflineMode) return;

      await actions.enterOfflineMode();
      toast.info(t("offline.disconnected"), {
        toastId: "offline-status",
        autoClose: 5000,
      });
    }

    async function handleOnline() {
      const { state, actions } = useOfflineStore.getState();
      if (!state.isOfflineMode) return;

      const isServerUp = await actions.tryReconnect();

      if (isServerUp) {
        toast.success(t("offline.reconnected"), {
          toastId: "offline-status",
          autoClose: 3000,
        });
      } else {
        toast.warning(t("offline.reconnectFailed"), {
          toastId: "offline-status",
          autoClose: 5000,
        });
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [t]);

  return null;
}
