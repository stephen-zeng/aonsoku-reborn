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
        variant="root"
        title={t("sidebar.albums")}
        count={albumsCount}
        showUserMenu={false}
      />
      <div className="px-4 pb-4">
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
