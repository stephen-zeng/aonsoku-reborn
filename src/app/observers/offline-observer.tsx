import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { subsonic } from "@/service/subsonic";
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

      actions.setReconnecting(true);

      const isServerUp = await subsonic.ping
        .pingView()
        .catch(() => false);

      if (isServerUp) {
        actions.clearOfflineMode();
        toast.success(t("offline.reconnected"), {
          toastId: "offline-status",
          autoClose: 3000,
        });
      } else {
        actions.setReconnecting(false);
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
