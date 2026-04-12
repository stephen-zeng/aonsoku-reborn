import { memo, ReactNode, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/app/components/ui/drawer";
import { useAppWindow } from "@/app/hooks/use-app-window";
import { useFullscreenPlayerSettings } from "@/store/player.store";
import { enterFullscreen, exitFullscreen } from "@/utils/browser";
import { isDesktop } from "@/utils/desktop";
import { setDesktopTitleBarColors } from "@/utils/theme";
import { FullscreenBackdrop } from "./backdrop";
import { FullscreenDragHandler } from "./drag-handler";
import { FullscreenContent } from "./fullscreen-content";

interface FullscreenModeProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MemoFullscreenBackdrop = memo(FullscreenBackdrop);
const MemoFullscreenContent = memo(FullscreenContent);

export default function FullscreenMode({
  children,
  open,
  onOpenChange,
}: FullscreenModeProps) {
  const { enterFullscreenWindow, exitFullscreenWindow } = useAppWindow();
  const { autoFullscreenEnabled } = useFullscreenPlayerSettings();

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
        className="h-screen w-screen rounded-t-none border-none select-none cursor-default mt-0"
        showHandle={false}
        aria-describedby={undefined}
      >
        <MemoFullscreenBackdrop />
        <FullscreenDragHandler />
        <div className="absolute inset-0 flex flex-col bg-black/0 z-10 fullscreen-safe-area">
          <MemoFullscreenContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
