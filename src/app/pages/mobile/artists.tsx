import { MoreVerticalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArtistsFallback } from "@/app/components/fallbacks/artists.tsx";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { PreviewCard } from "@/app/components/preview-card/card";
import { Button } from "@/app/components/ui/button";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { queryKeys } from "@/utils/queryKeys";

export default function MobileArtistsList() {
  const { t } = useTranslation();

  const { data: artists, isLoading } = useOfflineQuery(
    [...queryKeys.artist.all],
    subsonic.artists.getAll,
    { offlineFn: offlineData.artists },
  );

  if (isLoading) return <ArtistsFallback />;
  if (!artists) return null;

  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="root"
        title={t("sidebar.artists")}
        count={artists.length}
        showUserMenu={false}
      />
      <div className="flex flex-col">
        {artists.map((artist) => (
          <Link
            key={artist.id}
            to={ROUTES.ARTIST.PAGE(artist.id)}
            className="flex items-center gap-4 px-4 py-3 active:bg-accent/50 transition-colors"
          >
            <div className="size-14 shrink-0 overflow-hidden rounded-full bg-secondary">
              <PreviewCard.Image
                coverArtId={artist.coverArt}
                coverArtType="artist"
                alt={artist.name}
                className="size-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-base truncate">{artist.name}</h3>
              <p className="text-sm text-muted-foreground truncate">
                {t("artist.info.albumsCount", {
                  count: artist.albumCount,
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // TODO: Artist actions menu
              }}
            >
              <MoreVerticalIcon className="size-5" />
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
