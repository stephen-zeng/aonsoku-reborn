import { useEffect } from "react";
import { Location, Outlet, useLocation } from "react-router-dom";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/store/ui.store";
import { scrollPageToTop } from "@/utils/scrollPageToTop";

export function MainRoutes() {
  const { pathname } = useLocation() as Location;
  const { isCollapsed } = useSidebar();

  useEffect(() => {
    if (pathname) scrollPageToTop();
  }, [pathname]);

  return (
    <main
      className={cn(
        "flex h-full pl-0 md:pl-mini-sidebar pt-header pb-[calc(var(--player-height)+var(--bottom-nav-height))]",
        isCollapsed ? "xl:pl-mini-sidebar" : "xl:pl-sidebar",
      )}
    >
      <ScrollArea
        id="main-scroll-area"
        className="w-full bg-background-foreground"
      >
        <Outlet />
      </ScrollArea>
    </main>
  );
}
