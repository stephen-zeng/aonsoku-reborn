import { useIsPortraitViewport } from "@/app/hooks/use-mobile";
import { hasElectronBridge, isLinux } from "@/utils/desktop";

export function FullscreenDragHandler() {
  const isPortraitViewport = useIsPortraitViewport();

  if (isPortraitViewport) return null;

  if (!hasElectronBridge() || !isLinux) return null;

  return (
    <div className="absolute h-header left-0 right-[94px] electron-drag z-10" />
  );
}
