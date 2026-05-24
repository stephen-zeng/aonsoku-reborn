import { DiscAlbumIcon, SearchIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { AlbumGridCard } from "@/app/components/albums/album-grid-card";
import { CardSkeleton } from "@/app/components/fallbacks/ui-fallbacks";
import { InfiniteScroll } from "@/app/components/infinite-scroll";
import { MobileEmptyState } from "@/app/components/mobile/empty-state";
import { MobileSearchBar } from "@/app/components/mobile/search-bar";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { AlbumsFilters, AlbumsSearchParams } from "@/utils/albumsFilter";
import { SearchParamsHandler } from "@/utils/searchParamsHandler";
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
        <div className="flex flex-col mb-4">
          <Skeleton id="detail-page-title" className="h-8 w-32 mb-1" />
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
  const [searchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);
  const [searchOpen, setSearchOpen] = useState(false);
  const handleSearchOpenChange = useCallback(
    (v: boolean) => setSearchOpen(v),
    [],
  );
  const {
    isLoading,
    isEmpty,
    albums,
    albumsCount,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAlbumsListModel();

  const currentFilter = getSearchParam<string>(
    AlbumsSearchParams.MainFilter,
    "",
  );
  const query = getSearchParam<string>(AlbumsSearchParams.Query, "");
  const hasSearchFilter =
    currentFilter === AlbumsFilters.Search && query !== "";

  if (isLoading && albums.length === 0) return <MobileAlbumsFallback />;
  if (isEmpty && !hasSearchFilter) {
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
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
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <SearchIcon className="size-5" />
          </Button>
        </div>
        <MobileSearchBar
          open={searchOpen}
          onOpenChange={handleSearchOpenChange}
          placeholder={t("album.list.search.placeholder")}
        />
        {albums.length === 0 ? (
          <div className="flex justify-center items-center py-16">
            <p className="text-sm text-muted-foreground">
              {t("common.noResults")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {albums.map((album) => (
              <AlbumGridCard key={album.id} album={album} />
            ))}
          </div>
        )}
        <InfiniteScroll
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isLoading={isFetchingNextPage}
        />
      </div>
    </div>
  );
}
