import { useIsPortraitViewport } from "@/app/hooks/use-mobile";
import { isDesktop, isLinux } from "@/utils/desktop";

export function FullscreenDragHandler() {
  const isPortraitViewport = useIsPortraitViewport();

  if (!isDesktop() || !isLinux || isPortraitViewport) return null;

  return (
    <div className="absolute h-header left-0 right-[94px] electron-drag z-10" />
  );
}
