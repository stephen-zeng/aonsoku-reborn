import { MiniSidebarItem } from "@/app/components/sidebar/mini-item";
import { ResizeHandle } from "@/app/components/ui/resize-handle";
import { useResizePanel } from "@/app/hooks/use-resize-panel";
import { cn } from "@/lib/utils";
import { useAppPages } from "@/store/app.store";
import { DEFAULT_SIDEBAR_WIDTH, useSidebar } from "@/store/ui.store";
import { libraryItems, mainMenuItems } from "./sidebar";

export function MiniSidebar() {
  const { hideRadiosSection } = useAppPages();
  const { isCollapsed, setWidth, setIsCollapsed } = useSidebar();

  const { handleMouseDown, handleDoubleClick } = useResizePanel({
    cssVar: "--sidebar-width",
    min: 160,
    max: 420,
    defaultWidth: DEFAULT_SIDEBAR_WIDTH,
    direction: "right",
    onWidthChange: setWidth,
    collapseThreshold: 120,
    onCollapse: setIsCollapsed,
    isCollapsed,
  });

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col items-center justify-start gap-1 min-w-mini-sidebar max-w-mini-sidebar border-r fixed top-header left-0 bottom-0 pb-player bg-background z-30 py-2 pr-2",
        isCollapsed ? "xl:flex" : "xl:hidden",
      )}
      style={{ paddingLeft: "calc(var(--safe-area-left) + 0.5rem)" }}
    >
      {menuItems.map((item) => {
        // Setting to show/hide Radios section
        if (hideRadiosSection && item.id === "radios") return null;

        return <MiniSidebarItem item={item} key={item.route} />;
      })}

      <ResizeHandle
        side="right"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      />
    </aside>
  );
}

const menuItems = [...mainMenuItems, ...libraryItems];
