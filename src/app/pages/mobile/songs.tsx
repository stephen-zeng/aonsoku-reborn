import {
  EllipsisVertical,
  Music2Icon,
  SearchIcon,
  SortAscIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { InfiniteScroll } from "@/app/components/infinite-scroll";
import { MobileEmptyState } from "@/app/components/mobile/empty-state";
import { MobileSearchBar } from "@/app/components/mobile/search-bar";
import { MobileSortDrawer } from "@/app/components/mobile/sort-drawer";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { SongMenuOptions } from "@/app/components/song/menu-options";
import { CachedIndicator } from "@/app/components/table/cached-indicator";
import { CoverImage } from "@/app/components/table/cover-image";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useTotalSongs } from "@/app/hooks/use-total-songs";
import { cn } from "@/lib/utils";
import {
  getOfflineSongsList,
  useOfflineInfiniteQuery,
} from "@/lib/offlineQueryClient";
import { getArtistAllSongs, songsSearch } from "@/queries/songs";
import { useIsCurrentPlaying, usePlayerActions } from "@/store/player.store";
import {
  AlbumsFilters,
  AlbumsSearchParams,
  SongsOrderByOptions,
  SortOptions,
} from "@/utils/albumsFilter";
import { queryKeys } from "@/utils/queryKeys";
import { SearchParamsHandler } from "@/utils/searchParamsHandler";
import { ISong } from "@/types/responses/song";

const DEFAULT_OFFSET = 100;

function MobileSongsFallback() {
  const { t } = useTranslation();
  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="sub"
        title={t("sidebar.songs")}
        transparentTheme="default"
      />
      <div className="flex flex-col">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <Skeleton id="detail-page-title" className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="size-10 rounded-md" />
            <Skeleton className="size-10 rounded-md" />
          </div>
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2">
            <Skeleton className="size-12 rounded shadow shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="size-10 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MobileSongsList() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);
  const { setSongList } = usePlayerActions();
  const { data: songCountData } = useTotalSongs();

  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const handleSearchOpenChange = useCallback(
    (v: boolean) => setSearchOpen(v),
    [],
  );

  const filter = getSearchParam<string>(AlbumsSearchParams.MainFilter, "");
  const query = getSearchParam<string>(AlbumsSearchParams.Query, "");
  const artistId = getSearchParam<string>(AlbumsSearchParams.ArtistId, "");
  const artistName = getSearchParam<string>(AlbumsSearchParams.ArtistName, "");
  const orderBy = getSearchParam<SongsOrderByOptions>(
    "orderBy",
    SongsOrderByOptions.LastAdded,
  );
  const sort = getSearchParam<SortOptions>("sort", SortOptions.Desc);

  const filterByArtist = artistId !== "" && artistName !== "";

  async function fetchSongs({ pageParam = 0 }) {
    if (filterByArtist) {
      return getArtistAllSongs(artistId, { orderBy, sort });
    }
    return songsSearch({
      query: filter === AlbumsFilters.Search ? query : "",
      songCount: DEFAULT_OFFSET,
      songOffset: pageParam,
      orderBy,
      sort,
    });
  }

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useOfflineInfiniteQuery(
      [...queryKeys.song.all, filter, query, artistId, orderBy, sort],
      ({ pageParam }) => fetchSongs({ pageParam }),
      {
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextOffset,
        offlineFn: async () => ({
          songs: await getOfflineSongsList({
            filter,
            query,
            artistId,
            orderBy,
            sort,
          }),
          nextOffset: null,
        }),
      },
    );

  const songlist = data?.pages.flatMap((page) => page.songs) ?? [];

  const title = filterByArtist
    ? t("songs.list.byArtist", { artist: artistName })
    : t("sidebar.songs");

  const hasSearchFilter = filter === AlbumsFilters.Search && query !== "";

  if (isLoading && songlist.length === 0 && !hasSearchFilter) {
    return <MobileSongsFallback />;
  }

  if (songlist.length === 0 && !hasSearchFilter) {
    return (
      <MobileEmptyState
        headerTitle={title}
        title={title}
        description={t("common.noResults")}
        icon={<Music2Icon className="size-12" />}
      />
    );
  }

  const songCount = (filterByArtist ? songlist.length : songCountData) ?? 0;

  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="sub"
        title={title}
        transparentTheme="default"
      />
      <div className="flex flex-col pb-4">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h1
              id="detail-page-title"
              className="text-2xl font-bold tracking-tight"
            >
              {title}
            </h1>
            <span className="text-xs text-muted-foreground font-medium">
              {songCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <SearchIcon className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={() => setSortOpen(true)}
            >
              <SortAscIcon className="size-5" />
            </Button>
          </div>
        </div>
        <div className="px-4">
          <MobileSearchBar
            open={searchOpen}
            onOpenChange={handleSearchOpenChange}
            placeholder={t("songs.list.search.placeholder")}
          />
        </div>
        {songlist.length === 0 ? (
          <div className="flex justify-center items-center py-16">
            <p className="text-sm text-muted-foreground">
              {t("common.noResults")}
            </p>
          </div>
        ) : (
          songlist.map((song, index) => (
            <MobileSongRow
              key={`${song.id}-${index}`}
              song={song}
              onClick={() =>
                setSongList(songlist, index, false, undefined, title)
              }
            />
          ))
        )}
        <InfiniteScroll
          fetchNextPage={fetchNextPage}
          hasNextPage={!!hasNextPage}
          isLoading={isFetchingNextPage}
        />
      </div>
      <MobileSortDrawer open={sortOpen} onOpenChange={setSortOpen} />
    </div>
  );
}

function MobileSongRow({
  song,
  onClick,
}: {
  song: ISong;
  onClick: () => void;
}) {
  const isCurrentPlaying = useIsCurrentPlaying(song.id);

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center gap-3 px-4 py-2 active:bg-accent/50 transition-colors focus:outline-none focus:bg-accent/30"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CoverImage
        coverArt={song.coverArt}
        coverArtType="song"
        albumId={song.albumId}
        altText={song.title}
        size={48}
        isCurrentPlaying={isCurrentPlaying}
      />
      <div className="flex-1 min-w-0">
        <h3
          className={cn(
            "font-medium text-sm truncate",
            isCurrentPlaying && "text-primary",
          )}
        >
          {song.title}
        </h3>
        <p className="text-xs text-muted-foreground truncate">
          {song.artist} • {song.album}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <CachedIndicator songId={song.id} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={(e) => e.stopPropagation()}
            >
              <EllipsisVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <SongMenuOptions
              variant="dropdown"
              song={song}
              showLikeOption={true}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
