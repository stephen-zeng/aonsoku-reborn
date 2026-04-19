import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { ClearFilterButton } from "@/app/components/search/clear-filter-button";
import { ExpandableSearchInput } from "@/app/components/search/expandable-input";
import { SongListLayout } from "@/app/components/song/song-list-layout";
import {
  SongsOrderByFilter,
  SongsSortFilter,
} from "@/app/components/songs/songs-filters";
import { useTotalSongs } from "@/app/hooks/use-total-songs";
import { getArtistAllSongs, songsSearch } from "@/queries/songs";
import { useIsOnline } from "@/store/cache.store";
import {
  AlbumsFilters,
  AlbumsSearchParams,
  SongsOrderByOptions,
  SortOptions,
} from "@/utils/albumsFilter";
import { queryKeys } from "@/utils/queryKeys";
import { SearchParamsHandler } from "@/utils/searchParamsHandler";

const DEFAULT_OFFSET = 100;

export default function SongList() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);
  const isOnline = useIsOnline();

  const filter = getSearchParam<string>(AlbumsSearchParams.MainFilter, "");
  const query = getSearchParam<string>(AlbumsSearchParams.Query, "");
  const artistId = getSearchParam<string>(AlbumsSearchParams.ArtistId, "");
  const artistName = getSearchParam<string>(AlbumsSearchParams.ArtistName, "");
  const orderBy = getSearchParam<SongsOrderByOptions>(
    "orderBy",
    SongsOrderByOptions.LastAdded,
  );
  const sort = getSearchParam<SortOptions>("sort", SortOptions.Desc);

  const searchFilterIsSet = filter === AlbumsFilters.Search && query !== "";
  const filterByArtist = artistId !== "" && artistName !== "";
  const hasSomeFilter = searchFilterIsSet || filterByArtist;

  async function fetchSongs({ pageParam = 0 }) {
    if (filterByArtist) {
      return getArtistAllSongs(artistId, { orderBy, sort });
    }

    return songsSearch({
      query: searchFilterIsSet ? query : "",
      songCount: DEFAULT_OFFSET,
      songOffset: pageParam,
      orderBy,
      sort,
    });
  }

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: [queryKeys.song.all, filter, query, artistId, orderBy, sort],
      initialPageParam: 0,
      queryFn: fetchSongs,
      getNextPageParam: (lastPage) => lastPage.nextOffset,
      enabled: isOnline,
    });

  const { data: songCountData, isLoading: songCountIsLoading } =
    useTotalSongs();

  const songlist = data?.pages.flatMap((page) => page.songs) ?? [];
  const songCount = (hasSomeFilter ? songlist.length : songCountData) ?? 0;

  const title = filterByArtist
    ? t("songs.list.byArtist", { artist: artistName })
    : t("sidebar.songs");

  return (
    <SongListLayout
      title={title}
      songCount={songCount}
      songCountLoading={songCountIsLoading}
      songlist={songlist}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage ?? false}
      sourceName={filterByArtist ? artistName : title}
      headerActions={
        <>
          {filterByArtist && <ClearFilterButton />}
          <ExpandableSearchInput
            placeholder={t("songs.list.search.placeholder")}
          />
          <SongsSortFilter />
          <SongsOrderByFilter />
        </>
      }
    />
  );
}
