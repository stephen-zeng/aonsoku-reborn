import {
  DiscAlbumIcon,
  HeartIcon,
  HomeIcon,
  ListMusicIcon,
  Mic2Icon,
  Music2Icon,
  RadioIcon,
} from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import { CreatePlaylistDialog } from "@/app/components/playlist/form-dialog";
import {
  SectionTitle,
  SidebarPlaylists,
  SidebarSection,
} from "@/app/components/playlist/sidebar-list";
import { SidebarGenerator } from "@/app/components/sidebar/sidebar-generator";
import { ResizeHandle } from "@/app/components/ui/resize-handle";
import { useResizePanel } from "@/app/hooks/use-resize-panel";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/routes/routesList";
import { DEFAULT_SIDEBAR_WIDTH, useSidebar } from "@/store/ui.store";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

const ListMusic = memo(ListMusicIcon);
const Mic2 = memo(Mic2Icon);
const Music2 = memo(Music2Icon);
const Radio = memo(RadioIcon);
const DiscAlbum = memo(DiscAlbumIcon);
const Home = memo(HomeIcon);
const Heart = memo(HeartIcon);

const MemoSidebarGenerator = memo(SidebarGenerator);

export function Sidebar({ className }: SidebarProps) {
  const { t } = useTranslation();
  const { isCollapsed, setWidth } = useSidebar();

  const { handleMouseDown, handleDoubleClick } = useResizePanel({
    cssVar: "--sidebar-width",
    min: 200,
    max: 420,
    defaultWidth: DEFAULT_SIDEBAR_WIDTH,
    direction: "right",
    onWidthChange: setWidth,
  });

  return (
    <aside>
      <div
        className={cn(
          "hidden flex-col min-w-sidebar max-w-sidebar border-r fixed top-header left-0 bottom-0 pb-player bg-background z-50",
          isCollapsed ? "xl:hidden" : "xl:flex",
          className,
        )}
        style={{ paddingLeft: "var(--safe-area-left)" }}
      >
        <div className="space-y-4 py-4 pt-4">
          <SidebarSection>
            <div>
              <MemoSidebarGenerator list={mainMenuItems} />
            </div>
          </SidebarSection>
          <SidebarSection>
            <SectionTitle>{t("sidebar.library")}</SectionTitle>
            <div>
              <MemoSidebarGenerator
                list={libraryItems.filter(
                  (item) => item.id !== SidebarItems.Playlists,
                )}
              />
            </div>
          </SidebarSection>
        </div>

        <SidebarPlaylists />
        <ResizeHandle
          side="right"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
        />
      </div>

      <CreatePlaylistDialog />
    </aside>
  );
}

export enum SidebarItems {
  Home = "home",
  Artists = "artists",
  Songs = "songs",
  Favorites = "favorites",
  Albums = "albums",
  Playlists = "playlists",
  Radios = "radios",
}

export const mainMenuItems = [
  {
    id: SidebarItems.Home,
    title: "sidebar.home",
    route: ROUTES.LIBRARY.HOME,
    icon: Home,
  },
];

export const libraryItems = [
  {
    id: SidebarItems.Artists,
    title: "sidebar.artists",
    route: ROUTES.LIBRARY.ARTISTS,
    icon: Mic2,
  },
  {
    id: SidebarItems.Songs,
    title: "sidebar.songs",
    route: ROUTES.LIBRARY.SONGS,
    icon: Music2,
  },
  {
    id: SidebarItems.Albums,
    title: "sidebar.albums",
    route: ROUTES.LIBRARY.ALBUMS,
    icon: DiscAlbum,
  },
  {
    id: SidebarItems.Favorites,
    title: "sidebar.favorites",
    route: ROUTES.LIBRARY.FAVORITES,
    icon: Heart,
  },
  {
    id: SidebarItems.Playlists,
    title: "sidebar.playlists",
    route: ROUTES.LIBRARY.PLAYLISTS,
    icon: ListMusic,
  },
  {
    id: SidebarItems.Radios,
    title: "sidebar.radios",
    route: ROUTES.LIBRARY.RADIOS,
    icon: Radio,
  },
];
