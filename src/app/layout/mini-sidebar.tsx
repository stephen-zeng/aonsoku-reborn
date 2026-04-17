import { MiniSidebarItem } from "@/app/components/sidebar/mini-item";
import { cn } from "@/lib/utils";
import { useAppPages } from "@/store/app.store";
import { useSidebar } from "@/store/ui.store";
import { libraryItems, mainMenuItems } from "./sidebar";

export function MiniSidebar() {
  const { hideRadiosSection } = useAppPages();
  const { isCollapsed } = useSidebar();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col items-center justify-start gap-1 min-w-mini-sidebar max-w-mini-sidebar border-r fixed top-header left-0 bottom-0 pb-player bg-background z-10 p-2",
        isCollapsed ? "xl:flex" : "xl:hidden",
      )}
      style={{ paddingLeft: "var(--safe-area-left)" }}
    >
      {menuItems.map((item) => {
        // Setting to show/hide Radios section
        if (hideRadiosSection && item.id === "radios") return null;

        return <MiniSidebarItem item={item} key={item.route} />;
      })}
    </aside>
  );
}

const menuItems = [...mainMenuItems, ...libraryItems];
