import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";
import { closeFullscreenPlayerWithHistory } from "@/routes/fullscreenRouter";
import { router } from "@/routes/router";
import { usePlayerStore } from "@/store/player.store";
import { executeBackButtonHandlers } from "@/utils/back-button-registry";

function getParentPath(pathname: string): string | null {
  const cleanPath = pathname.replace(/^\/|\/$/g, "");
  const segments = cleanPath.split("/");

  if (segments[0] === "library") {
    if (segments[1] === "artists") {
      if (segments[2]) {
        return "/library/artists";
      }
      return "/mobile/library";
    }
    if (segments[1] === "albums") {
      if (segments[2]) {
        return "/library/albums";
      }
      return "/mobile/library";
    }
    if (segments[1] === "playlists") {
      return "/mobile/library";
    }
    if (
      segments[1] === "songs" ||
      segments[1] === "favorites" ||
      segments[1] === "radios"
    ) {
      return "/mobile/library";
    }
  }

  return null;
}

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

      // 3. Handle hierarchical back navigation
      const { pathname, search } = router.state.location;

      // Special case: mobile settings page tabs/categories
      if (pathname === "/mobile/settings") {
        const params = new URLSearchParams(search);
        if (params.has("page")) {
          router.navigate("/mobile/settings", { replace: true });
          return;
        }
      }

      const parentPath = getParentPath(pathname);
      if (parentPath) {
        router.navigate(parentPath, { replace: true });
        return;
      }

      // If we are at a root tab/destination, exit the app
      App.exitApp();
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, []);

  return null;
}
