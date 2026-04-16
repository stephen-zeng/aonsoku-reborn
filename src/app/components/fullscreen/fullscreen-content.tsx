import { useEffect } from "react";
import { useIsPortraitViewport } from "@/app/hooks/use-mobile";
import { useFullscreenPlayerState } from "@/store/player.store";
import { DesktopLayout } from "./desktop-layout";
import { MobileLayout } from "./mobile-layout";

export function FullscreenContent() {
  const isPortraitViewport = useIsPortraitViewport();
  const { fullscreenPlayerTab, setDesktopFullscreenPanelView } =
    useFullscreenPlayerState();

  useEffect(() => {
    if (isPortraitViewport || fullscreenPlayerTab === "playing") {
      return;
    }

    setDesktopFullscreenPanelView(fullscreenPlayerTab);
  }, [fullscreenPlayerTab, isPortraitViewport, setDesktopFullscreenPanelView]);

  return isPortraitViewport ? (
    <MobileLayout showDragHandle />
  ) : (
    <DesktopLayout />
  );
}
