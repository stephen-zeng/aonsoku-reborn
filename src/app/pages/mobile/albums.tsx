import { DiscAlbumIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AlbumGridCard } from "@/app/components/albums/album-grid-card";
import { CardSkeleton } from "@/app/components/fallbacks/ui-fallbacks";
import { InfiniteScroll } from "@/app/components/infinite-scroll";
import { MobileEmptyState } from "@/app/components/mobile/empty-state";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useAlbumsListModel } from "../albums/list.model";

function MobileAlbumsFallback() {
  const { t } = useTranslation();
  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="sub"
        title={t("sidebar.albums")}
        transparentTheme="default"
      />
      <div className="px-4 py-4">
        <div className="flex flex-col mb-4 gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MobileAlbumsList() {
  const { t } = useTranslation();
  const {
    isLoading,
    isEmpty,
    albums,
    albumsCount,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAlbumsListModel();

  if (isLoading && albums.length === 0) return <MobileAlbumsFallback />;
  if (isEmpty) {
    return (
      <MobileEmptyState
        headerTitle={t("sidebar.albums")}
        title={t("album.list.empty.title")}
        description={t("album.list.empty.info")}
        icon={<DiscAlbumIcon className="size-12" />}
      />
    );
  }

  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="sub"
        title={t("sidebar.albums")}
        transparentTheme="default"
      />
      <div className="px-4 py-4">
        <div className="flex flex-col mb-4">
          <h1
            id="detail-page-title"
            className="text-2xl font-bold tracking-tight"
          >
            {t("sidebar.albums")}
          </h1>
          <span className="text-xs text-muted-foreground font-medium">
            {albumsCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          {albums.map((album) => (
            <AlbumGridCard key={album.id} album={album} />
          ))}
        </div>
        <InfiniteScroll
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isLoading={isFetchingNextPage}
        />
      </div>
    </div>
  );
}
