import { useEffect, useState } from "react";
import { hasElectronBridge } from "@/utils/desktop";

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
    if (!hasElectronBridge()) return;

    const fullscreen = await window.api.isFullScreen();

    if (!fullscreen) {
      window.api.enterFullScreen();
      setIsFullscreen(true);
    }
  };

  const exitFullscreenWindow = async () => {
    if (!hasElectronBridge()) return;

    const fullscreen = await window.api.isFullScreen();

    if (fullscreen) {
      window.api.exitFullScreen();
      setIsFullscreen(false);
    }
  };

  const maximizeWindow = () => {
    if (!hasElectronBridge()) return;

    window.api.toggleMaximize(isMaximized);
  };

  const minimizeWindow = () => {
    if (!hasElectronBridge()) return;

    window.api.toggleMinimize();
  };

  const closeWindow = () => {
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
