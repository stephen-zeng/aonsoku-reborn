import { useEffect, useState } from "react";
import { hasElectronBridge, hasTauriBridge } from "@/utils/desktop";
import {
  closeTauriWindow,
  isTauriWindowFullscreen,
  isTauriWindowMaximized,
  isTauriWindowSupported,
  listenTauriWindowStateChanges,
  minimizeTauriWindow,
  setTauriWindowFullscreen,
  toggleTauriWindowMaximize,
} from "@/utils/tauri-window";

interface AppWindowType {
  isFullscreen: boolean;
  isMaximized: boolean;
  enterFullscreenWindow: () => Promise<void>;
  exitFullscreenWindow: () => Promise<void>;
  maximizeWindow: () => void;
  minimizeWindow: () => void;
  closeWindow: () => void;
}

export function useAppWindow(): AppWindowType {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!hasElectronBridge() && !hasTauriBridge()) return;

    if (isTauriWindowSupported()) {
      let disposed = false;
      let cleanup: (() => void) | null = null;

      const fetchWindowStatus = async () => {
        const [fullscreenStatus, maximizedStatus] = await Promise.all([
          isTauriWindowFullscreen(),
          isTauriWindowMaximized(),
        ]);
        if (disposed) return;
        setIsFullscreen(fullscreenStatus);
        setIsMaximized(maximizedStatus);
      };

      fetchWindowStatus();
      listenTauriWindowStateChanges(fetchWindowStatus).then((unlisten) => {
        if (disposed) {
          unlisten();
          return;
        }
        cleanup = unlisten;
      });

      return () => {
        disposed = true;
        cleanup?.();
      };
    }

    if (!hasElectronBridge()) return;

    const fetchWindowStatus = async () => {
      const [fullscreenStatus, maximizedStatus] = await Promise.all([
        window.api.isFullScreen(),
        window.api.isMaximized(),
      ]);
      setIsFullscreen(fullscreenStatus);
      setIsMaximized(maximizedStatus);
    };

    fetchWindowStatus();

    function handleFullScreenStatus(status: boolean) {
      setIsFullscreen(status);
    }

    window.api.fullscreenStatusListener(handleFullScreenStatus);

    function handleMaximizedStatus(status: boolean) {
      setIsMaximized(status);
    }

    window.api.maximizedStatusListener(handleMaximizedStatus);

    return () => {
      window.api.removeFullscreenStatusListener();
      window.api.removeMaximizedStatusListener();
    };
  }, []);

  const enterFullscreenWindow = async () => {
    if (isTauriWindowSupported()) {
      const fullscreen = await isTauriWindowFullscreen();
      if (!fullscreen) {
        await setTauriWindowFullscreen(true);
        setIsFullscreen(true);
      }
      return;
    }

    if (!hasElectronBridge()) return;

    const fullscreen = await window.api.isFullScreen();

    if (!fullscreen) {
      window.api.enterFullScreen();
      setIsFullscreen(true);
    }
  };

  const exitFullscreenWindow = async () => {
    if (isTauriWindowSupported()) {
      const fullscreen = await isTauriWindowFullscreen();
      if (fullscreen) {
        await setTauriWindowFullscreen(false);
        setIsFullscreen(false);
      }
      return;
    }

    if (!hasElectronBridge()) return;

    const fullscreen = await window.api.isFullScreen();

    if (fullscreen) {
      window.api.exitFullScreen();
      setIsFullscreen(false);
    }
  };

  const maximizeWindow = () => {
    if (isTauriWindowSupported()) {
      toggleTauriWindowMaximize()
        .then(async () => {
          setIsMaximized(await isTauriWindowMaximized());
        })
        .catch(() => {});
      return;
    }

    if (!hasElectronBridge()) return;

    window.api.toggleMaximize(isMaximized);
  };

  const minimizeWindow = () => {
    if (isTauriWindowSupported()) {
      minimizeTauriWindow().catch(() => {});
      return;
    }

    if (!hasElectronBridge()) return;

    window.api.toggleMinimize();
  };

  const closeWindow = () => {
    if (isTauriWindowSupported()) {
      closeTauriWindow().catch(() => {});
      return;
    }

    if (!hasElectronBridge()) return;

    window.api.closeWindow();
  };

  return {
    isFullscreen,
    isMaximized,
    enterFullscreenWindow,
    exitFullscreenWindow,
    maximizeWindow,
    minimizeWindow,
    closeWindow,
  };
}
