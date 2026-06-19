import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { DesktopHeaderStatusItems } from "@/app/components/header/mobile-page-header";
import { useAppWindow } from "@/app/hooks/use-app-window";
import { useWindowControlsOverlay } from "@/app/hooks/use-window-controls-overlay";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/store/ui.store";
import {
  hasElectronBridge,
  hasTauriBridge,
  isLinux,
  isMacOS,
  isWindows,
} from "@/utils/desktop";
import { isWindowControlsOverlayAvailable } from "@/utils/pwa";
import { startTauriWindowDrag } from "@/utils/tauri-window";
import CommandMenu from "../components/command/command-menu";
import { SwUpdateChip } from "../components/header/sw-update-chip";
import { Button } from "../components/ui/button";

const MemoCommandMenu = memo(CommandMenu);

function isInteractiveHeaderTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      'button,a,input,textarea,select,[role="button"],[role="link"],[data-tauri-no-drag]',
    ),
  );
}

export function Header() {
  const { t } = useTranslation();
  const { isFullscreen } = useAppWindow();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const hasWindowControls = isWindowControlsOverlayAvailable();
  const windowControlsOverlay = useWindowControlsOverlay();
  const isElectronApp = hasElectronBridge();
  const isTauriApp = hasTauriBridge();

  const [controlsWidth, setControlsWidth] = useState({ left: 0, right: 0 });

  useEffect(() => {
    if (
      windowControlsOverlay.visible &&
      windowControlsOverlay.titlebarAreaRect
    ) {
      const rect = windowControlsOverlay.titlebarAreaRect;
      const leftWidth = rect.x;
      const rightWidth = window.innerWidth - (rect.x + rect.width);

      setControlsWidth({ left: leftWidth, right: rightWidth });
    } else {
      setControlsWidth({ left: 0, right: 0 });
    }
  }, [windowControlsOverlay.visible, windowControlsOverlay.titlebarAreaRect]);

  const shouldAddSpacing =
    !isFullscreen && (isElectronApp || isTauriApp || hasWindowControls);

  const needsLeftSpacing = isMacOS && shouldAddSpacing;
  const hasTauriOverlayTitleBar = isTauriApp && isMacOS;

  const needsRightSpacing =
    shouldAddSpacing &&
    ((isElectronApp && (isWindows || isLinux)) ||
      (hasWindowControls && controlsWidth.right > 0));

  const leftSpacingWidth = needsLeftSpacing
    ? hasWindowControls && controlsWidth.left > 0
      ? controlsWidth.left
      : hasTauriOverlayTitleBar
        ? 82
        : 80
    : 0;

  const rightSpacingWidth = needsRightSpacing
    ? hasWindowControls && controlsWidth.right > 0
      ? controlsWidth.right
      : isWindows
        ? 122
        : 94
    : 0;
  const sidebarToggleLabel = t(
    isCollapsed ? "sidebar.expand" : "sidebar.collapse",
  );
  const SidebarToggleIcon = isCollapsed
    ? PanelLeftOpenIcon
    : PanelLeftCloseIcon;

  return (
    <header
      className="w-full hidden md:flex md:grid md:grid-cols-header items-center justify-between h-header pt-[var(--safe-area-top)] fixed top-0 right-0 left-0 z-20 bg-background border-b electron-drag"
      onMouseDown={(event) => {
        if (!hasTauriOverlayTitleBar || event.button !== 0) return;
        if (event.detail > 1) return;
        if (isInteractiveHeaderTarget(event.target)) return;
        startTauriWindowDrag();
      }}
      style={{
        paddingLeft: "max(1rem, var(--safe-area-left))",
        paddingRight: "max(1rem, var(--safe-area-right))",
      }}
    >
      <div className="flex items-center gap-2">
        {leftSpacingWidth > 10 && (
          <div
            style={{ width: `${leftSpacingWidth - 10}px` }}
            className="flex-shrink-0"
          />
        )}
        <div className="hidden xl:block w-8 h-8">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-8 w-8 p-0 rounded-md")}
            title={sidebarToggleLabel}
            aria-label={sidebarToggleLabel}
            data-state={isCollapsed ? "collapsed" : "expanded"}
            onClick={toggleSidebar}
          >
            <SidebarToggleIcon className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
        <SwUpdateChip />
      </div>
      <div className="hidden md:flex col-span-2 items-center justify-center">
        <div className="flex justify-center items-center px-4 gap-2 w-full">
          <MemoCommandMenu />
        </div>
      </div>
      <div className="flex justify-end items-center gap-2">
        <DesktopHeaderStatusItems />
        {rightSpacingWidth > 10 && (
          <div
            style={{ width: `${rightSpacingWidth - 10}px` }}
            className="flex-shrink-0"
          />
        )}
      </div>
    </header>
  );
}
