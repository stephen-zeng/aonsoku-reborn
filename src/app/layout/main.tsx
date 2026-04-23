import { useEffect } from "react";
import { Location, Outlet, useLocation } from "react-router-dom";
import { useIsXl } from "@/app/hooks/use-is-xl";
import { cn } from "@/lib/utils";
import { useMainDrawerState } from "@/store/player.store";
import { useSidebar } from "@/store/ui.store";
import { scrollPageToTop } from "@/utils/scrollPageToTop";

export function MainRoutes() {
  const { pathname } = useLocation() as Location;
  const { isCollapsed } = useSidebar();
  const { mainDrawerState, closeDrawer } = useMainDrawerState();
  const isXl = useIsXl();

  useEffect(() => {
    if (pathname) scrollPageToTop();
  }, [pathname]);

  // Auto-close right panel when resizing below xl
  useEffect(() => {
    if (mainDrawerState && !isXl) {
      closeDrawer();
    }
  }, [isXl, mainDrawerState, closeDrawer]);

  return (
    <main
      className={cn(
        "min-h-screen pl-0 md:pl-mini-sidebar pt-header pb-[calc(var(--player-height)+var(--bottom-nav-height))] transition-[padding] duration-300",
        isCollapsed ? "xl:pl-mini-sidebar" : "xl:pl-sidebar",
        mainDrawerState && "lg:pr-right-panel",
      )}
    >
      <div className="w-full bg-background-foreground">
        <Outlet />
      </div>
    </main>
  );
}
