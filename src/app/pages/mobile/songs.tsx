import { EllipsisVertical, SearchIcon, SortAscIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { InfiniteScroll } from "@/app/components/infinite-scroll";
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

export default function MobileSongsList() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);
  const { setSongList } = usePlayerActions();

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
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

  const { data: songCountData } = useTotalSongs();
  const songlist = data?.pages.flatMap((page) => page.songs) ?? [];
  const songCount = (filterByArtist ? songlist.length : songCountData) ?? 0;

  const title = filterByArtist
    ? t("songs.list.byArtist", { artist: artistName })
    : t("sidebar.songs");

  return (
    <div className="w-full flex flex-col">
      <MobilePageHeader
        variant="root"
        title={title}
        count={songCount}
        showUserMenu={false}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-10">
              <SearchIcon className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-10">
              <SortAscIcon className="size-5" />
            </Button>
          </div>
        }
      />
      <div className="flex flex-col pb-4">
        {songlist.map((song, index) => (
          <MobileSongRow
            key={`${song.id}-${index}`}
            song={song}
            onClick={() => setSongList(songlist, index, false, undefined, title)}
          />
        ))}
        <InfiniteScroll
          fetchNextPage={fetchNextPage}
          hasNextPage={!!hasNextPage}
          isLoading={isFetchingNextPage}
        />
      </div>
    </div>
  );
}

function MobileSongRow({ song, onClick }: { song: ISong; onClick: () => void }) {
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
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
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
