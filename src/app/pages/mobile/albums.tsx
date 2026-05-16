import { useTranslation } from "react-i18next";
import { AlbumGridCard } from "@/app/components/albums/album-grid-card";
import { EmptyAlbums } from "@/app/components/albums/empty-page";
import { AlbumsFallback } from "@/app/components/fallbacks/album-fallbacks";
import { InfiniteScroll } from "@/app/components/infinite-scroll";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { useAlbumsListModel } from "../albums/list.model";

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

  if (isLoading && albums.length === 0) return <AlbumsFallback />;
  if (isEmpty) return <EmptyAlbums />;

  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="sub"
        title={t("sidebar.albums")}
        showUserMenu={false}
      />
      <div className="px-4 py-4">
        <div className="flex flex-col mb-4">
          <h1 id="detail-page-title" className="text-2xl font-bold tracking-tight">
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
