import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { closeFullscreenPlayerWithHistory } from "@/routes/fullscreenRouter";
import { usePlayerStore } from "@/store/player.store";
import { executeBackButtonHandlers, getActiveHeaderBackHandler } from "@/utils/back-button-registry";

export function AndroidBackButtonObserver() {
  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() !== "android"
    ) {
      return;
    }

    const handler = App.addListener("backButton", () => {
      // 1. Run custom registered handlers (close dialogs, drawers, etc.)
      if (executeBackButtonHandlers()) {
        return;
      }

      // 2. Close fullscreen player if open
      const { fullscreenPlayerOpen } = usePlayerStore.getState().playerState;
      if (fullscreenPlayerOpen) {
        closeFullscreenPlayerWithHistory();
        return;
      }

      // 3. Handle back navigation of the active page header back button if present
      const headerBackHandler = getActiveHeaderBackHandler();
      if (headerBackHandler) {
        headerBackHandler();
        return;
      }

      // 4. Default: exit the app/return to desktop
      App.exitApp();
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, []);

  return null;
}
