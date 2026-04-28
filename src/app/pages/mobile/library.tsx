import {
  DiscAlbumIcon,
  HeartIcon,
  ListMusicIcon,
  Mic2Icon,
  Music2Icon,
  RadioIcon,
} from "lucide-react";
import { ElementType } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { EmptyPlaylistsMessage } from "@/app/components/playlist/empty-message";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { ROUTES } from "@/routes/routesList";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { subsonic } from "@/service/subsonic";
import { useAppPages } from "@/store/app.store";
import { queryKeys } from "@/utils/queryKeys";
import { cn } from "@/lib/utils";

interface LibraryRowProps {
  icon: ElementType;
  label: string;
  to: string;
  active?: boolean;
}

function LibraryRow({ icon: Icon, label, to, active }: LibraryRowProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors active:bg-accent/70",
        active ? "bg-secondary text-foreground" : "text-foreground/90",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

export default function MobileLibrary() {
  const { t } = useTranslation();
  const location = useLocation();
  const { hideRadiosSection } = useAppPages();

  const { data: playlists } = useOfflineQuery(
    [...queryKeys.playlist.all],
    subsonic.playlists.getAll,
    { offlineFn: offlineData.playlists },
  );

  const libraryLinks = [
    {
      icon: Mic2Icon,
      label: t("sidebar.artists"),
      to: ROUTES.LIBRARY.ARTISTS,
    },
    {
      icon: Music2Icon,
      label: t("sidebar.songs"),
      to: ROUTES.LIBRARY.SONGS,
    },
    {
      icon: DiscAlbumIcon,
      label: t("sidebar.albums"),
      to: ROUTES.LIBRARY.ALBUMS,
    },
    {
      icon: HeartIcon,
      label: t("sidebar.favorites"),
      to: ROUTES.LIBRARY.FAVORITES,
    },
    {
      icon: ListMusicIcon,
      label: t("sidebar.playlists"),
      to: ROUTES.LIBRARY.PLAYLISTS,
    },
    ...(hideRadiosSection
      ? []
      : [
          {
            icon: RadioIcon,
            label: t("sidebar.radios"),
            to: ROUTES.LIBRARY.RADIOS,
          },
        ]),
  ];

  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader variant="root" title={t("sidebar.library")} />
      <div className="px-4 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          {libraryLinks.map((item) => (
            <LibraryRow
              key={item.to}
              icon={item.icon}
              label={item.label}
              to={item.to}
              active={location.pathname.startsWith(item.to)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold px-1">
            {t("sidebar.playlists")}
          </h2>
          {playlists !== undefined && playlists.length > 0 ? (
            <div className="flex flex-col gap-1">
              {playlists.map((playlist) => (
                <LibraryRow
                  key={playlist.id}
                  icon={ListMusicIcon}
                  label={playlist.name}
                  to={ROUTES.PLAYLIST.PAGE(playlist.id)}
                  active={
                    location.pathname === ROUTES.PLAYLIST.PAGE(playlist.id)
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyPlaylistsMessage />
          )}
        </div>
      </div>
    </div>
  );
}
