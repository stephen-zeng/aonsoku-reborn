import { DiscAlbumIcon, Mic2Icon, Music2Icon } from "lucide-react";
import { ElementType } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { EmptyPlaylistsMessage } from "@/app/components/playlist/empty-message";
import { SidebarPlaylistGenerator } from "@/app/components/sidebar/sidebar-generator";
import { ROUTES } from "@/routes/routesList";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { subsonic } from "@/service/subsonic";
import { queryKeys } from "@/utils/queryKeys";

interface LibraryCardProps {
  icon: ElementType;
  label: string;
  to: string;
}

function LibraryCard({ icon: Icon, label, to }: LibraryCardProps) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 rounded-xl bg-secondary p-4 flex-1 min-h-[80px] transition-colors active:bg-secondary/70"
    >
      <Icon className="w-6 h-6" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

export default function MobileLibrary() {
  const { t } = useTranslation();

  const { data: playlists } = useOfflineQuery(
    [...queryKeys.playlist.all],
    subsonic.playlists.getAll,
    { offlineFn: offlineData.playlists },
  );

  const quickLinks = [
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
  ];

  return (
    <div className="w-full px-4 py-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t("sidebar.library")}</h1>

      <div className="flex gap-3">
        {quickLinks.map((item) => (
          <LibraryCard
            key={item.to}
            icon={item.icon}
            label={item.label}
            to={item.to}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold px-1">{t("sidebar.playlists")}</h2>
        {playlists !== undefined && playlists.length > 0 ? (
          <SidebarPlaylistGenerator playlists={playlists} />
        ) : (
          <EmptyPlaylistsMessage />
        )}
      </div>
    </div>
  );
}
