import { useSearchParams } from "react-router-dom";
import {
  getOfflineAlbumsList,
  useOfflineInfiniteQuery,
} from "@/lib/offlineQueryClient";
import {
  albumSearch,
  getAlbumList,
  getArtistDiscography,
} from "@/queries/albums";
import { AlbumListType } from "@/types/responses/album";
import {
  AlbumsFilters,
  AlbumsSearchParams,
  YearFilter,
  YearSortOptions,
} from "@/utils/albumsFilter";
import { queryKeys } from "@/utils/queryKeys";
import { SearchParamsHandler } from "@/utils/searchParamsHandler";

export function useAlbumsListModel() {
  const [searchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);
  const defaultOffset = 128;
  const oldestYear = "0001";
  const currentYear = new Date().getFullYear().toString();

  const currentFilter = getSearchParam<AlbumListType>(
    AlbumsSearchParams.MainFilter,
    AlbumsFilters.RecentlyAdded,
  );
  const yearFilter = getSearchParam<YearFilter>(
    AlbumsSearchParams.YearFilter,
    YearSortOptions.Oldest,
  );
  const genre = getSearchParam<string>(AlbumsSearchParams.Genre, "");
  const artistId = getSearchParam<string>(AlbumsSearchParams.ArtistId, "");
  const query = getSearchParam<string>(AlbumsSearchParams.Query, "");

  function getYearRange() {
    if (yearFilter === YearSortOptions.Oldest) {
      return [oldestYear, currentYear];
    } else {
      return [currentYear, oldestYear];
    }
  }

  const [fromYear, toYear] = getYearRange();

  const fetchAlbums = async ({ pageParam = 0 }) => {
    if (artistId !== "") {
      return getArtistDiscography(artistId);
    }

    if (currentFilter === AlbumsFilters.Search && query !== "") {
      return albumSearch({
        query,
        count: defaultOffset,
        offset: pageParam,
      });
    }

    return getAlbumList({
      type: currentFilter,
      size: defaultOffset,
      offset: pageParam,
      fromYear,
      toYear,
      genre,
    });
  };

  function enableMainQuery() {
    if (currentFilter === AlbumsFilters.ByGenre && genre === "") return false;

    return true;
  }

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useOfflineInfiniteQuery(
    [
      ...queryKeys.album.all,
      currentFilter,
      yearFilter,
      genre,
      artistId,
      query,
    ],
    ({ pageParam }) => fetchAlbums({ pageParam }),
    {
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextOffset,
      enabled: enableMainQuery(),
      offlineFn: async () => {
        const albums = await getOfflineAlbumsList({
          currentFilter,
          yearFilter,
          genre,
          artistId,
          query,
        });

        return {
          albums,
          nextOffset: null,
          albumsCount: albums.length,
        };
      },
    },
  );

  function getAlbums() {
    if (!data) return { albums: [], albumsCount: 0 };

    const albums = data.pages.flatMap((page) => page.albums);
    const albumsCount = data.pages[data.pages.length - 1].albumsCount;

    return {
      albums,
      albumsCount,
    };
  }

  const { albums, albumsCount } = getAlbums();

  const isEmpty = albums.length === 0 || !data;

  return {
    isLoading,
    isEmpty,
    albums,
    albumsCount,
    fetchNextPage,
    hasNextPage: !!hasNextPage,
    isFetchingNextPage,
  };
}
