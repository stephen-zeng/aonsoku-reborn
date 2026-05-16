import { MoreVerticalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { PreviewCard } from "@/app/components/preview-card/card";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { ROUTES } from "@/routes/routesList";
import { subsonic } from "@/service/subsonic";
import { queryKeys } from "@/utils/queryKeys";

function MobileArtistsFallback() {
  const { t } = useTranslation();
  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader variant="sub" title={t("sidebar.artists")} />
      <div className="flex flex-col">
        <div className="px-4 py-4 flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2">
            <Skeleton className="size-11 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="size-9 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MobileArtistsList() {
  const { t } = useTranslation();

  const { data: artists, isLoading } = useOfflineQuery(
    [...queryKeys.artist.all],
    subsonic.artists.getAll,
    {
      offlineFn: async () => {
        const data = await offlineData.artists();
        return data.length > 0 ? data : null;
      },
    },
  );

  if (isLoading && (!artists || artists.length === 0)) return <MobileArtistsFallback />;
  if (!artists) return null;

  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="sub"
        title={t("sidebar.artists")}
      />
      <div className="flex flex-col">
        <div className="px-4 py-4 flex flex-col">
          <h1 id="detail-page-title" className="text-2xl font-bold tracking-tight">
            {t("sidebar.artists")}
          </h1>
          <span className="text-xs text-muted-foreground font-medium">
            {artists.length}
          </span>
        </div>
        {artists.map((artist) => (
          <Link
            key={artist.id}
            to={ROUTES.ARTIST.PAGE(artist.id)}
            className="flex items-center gap-3 px-4 py-2 active:bg-accent/50 transition-colors"
          >
            <div className="size-11 shrink-0 overflow-hidden rounded-full bg-secondary relative">
              <PreviewCard.Image
                coverArtId={artist.coverArt}
                coverArtType="artist"
                alt={artist.name}
                className="size-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate">{artist.name}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {t("artist.info.albumsCount", {
                  count: artist.albumCount,
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // TODO: Artist actions menu
              }}
            >
              <MoreVerticalIcon className="size-4" />
            </Button>
          </Link>
        ))}
      </div>
    </div>
  );
}
