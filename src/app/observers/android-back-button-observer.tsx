import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { closeFullscreenPlayerWithHistory } from "@/routes/fullscreenRouter";
import { usePlayerStore } from "@/store/player.store";

export function AndroidBackButtonObserver() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    const handler = App.addListener("backButton", () => {
      const { fullscreenPlayerOpen } = usePlayerStore.getState().playerState;

      if (fullscreenPlayerOpen) {
        closeFullscreenPlayerWithHistory();
        return;
      }

      if (window.history.state?.idx > 0) {
        window.history.back();
        return;
      }

      App.exitApp();
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, []);

  return null;
}
