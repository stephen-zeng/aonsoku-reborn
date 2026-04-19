import { HomeIcon, LibraryIcon, SearchIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/routesList";

const navItems = [
  {
    id: "home",
    title: "sidebar.home",
    route: ROUTES.LIBRARY.HOME,
    icon: HomeIcon,
  },
  {
    id: "library",
    title: "sidebar.library",
    route: ROUTES.MOBILE.LIBRARY,
    icon: LibraryIcon,
  },
  {
    id: "search",
    title: "sidebar.miniSearch",
    route: ROUTES.MOBILE.SEARCH,
    icon: SearchIcon,
  },
] as const;

export function BottomNavigation() {
  const { t } = useTranslation();
  const location = useLocation();

  function isActive(route: string) {
    return location.pathname === route;
  }

  return (
    <nav
      className="md:hidden fixed left-0 right-0 z-30 bg-background border-t h-[--bottom-nav-height] bottom-0 pb-[var(--safe-area-bottom)]"
      style={{
        paddingLeft: "var(--safe-area-left)",
        paddingRight: "var(--safe-area-right)",
      }}
    >
      <div className="grid grid-cols-3 h-full">
        {navItems.map((item) => (
          <Link
            key={item.id}
            to={item.route}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-xs transition-colors",
              isActive(item.route)
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            <item.icon
              className={cn(
                "w-5 h-5",
                isActive(item.route) ? "stroke-[2]" : "stroke-[1.5]",
              )}
            />
            <span className="text-[10px] leading-none">{t(item.title)}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
