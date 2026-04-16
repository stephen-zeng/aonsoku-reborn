import { memo, ReactNode, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/app/components/ui/drawer";
import { useBackdropStyle } from "@/app/hooks/use-backdrop-bg";
import { useAppWindow } from "@/app/hooks/use-app-window";
import { closeFullscreenPlayerWithHistory } from "@/routes/fullscreenRouter";
import { useFullscreenPlayerSettings } from "@/store/player.store";
import { enterFullscreen, exitFullscreen } from "@/utils/browser";
import { isDesktop } from "@/utils/desktop";
import { setDesktopTitleBarColors } from "@/utils/theme";
import { FullscreenDragHandler } from "./drag-handler";
import { FullscreenContent } from "./fullscreen-content";

interface FullscreenModeProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MemoFullscreenContent = memo(FullscreenContent);

export default function FullscreenMode({
  children,
  open,
  onOpenChange,
}: FullscreenModeProps) {
  const { enterFullscreenWindow, exitFullscreenWindow } = useAppWindow();
  const { autoFullscreenEnabled } = useFullscreenPlayerSettings();
  const backdropStyle = useBackdropStyle();

  // biome-ignore lint/correctness/useExhaustiveDependencies: initial useEffect
  useEffect(() => {
    return () => {
      if (isDesktop()) {
        exitFullscreenWindow().then(() => {
          setDesktopTitleBarColors(false);
        });
      } else {
        exitFullscreen();
      }
    };
  }, []);

  async function handleFullscreen(open: boolean) {
    onOpenChange?.(open);

    if (!open) {
      closeFullscreenPlayerWithHistory();
    }

    if (isDesktop()) setDesktopTitleBarColors(open);

    if (!autoFullscreenEnabled) return;

    if (isDesktop()) {
      open ? await enterFullscreenWindow() : await exitFullscreenWindow();
      return;
    }

    open ? enterFullscreen() : exitFullscreen();
  }

  return (
    <Drawer
      fixed
      dismissible={true}
      handleOnly={false}
      disablePreventScroll={true}
      modal={false}
      open={open}
      onOpenChange={handleFullscreen}
    >
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerTitle className="sr-only">Big Player</DrawerTitle>
      <DrawerContent
        className="fullscreen-drawer-surface mt-0 h-dvh max-h-dvh w-screen rounded-t-none border-none select-none cursor-default"
        showHandle={false}
        aria-describedby={undefined}
        style={backdropStyle}
      >
        <FullscreenDragHandler />
        <div className="absolute inset-0 z-10 flex flex-col fullscreen-safe-area">
          <MemoFullscreenContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
