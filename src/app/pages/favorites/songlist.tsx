import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { SongListLayout } from "@/app/components/song/song-list-layout";
import { useTotalFavorites } from "@/app/hooks/use-favorite-songs";
import { getFavoriteSongs } from "@/queries/songs";
import { AlbumsSearchParams } from "@/utils/albumsFilter";
import { queryKeys } from "@/utils/queryKeys";
import { SearchParamsHandler } from "@/utils/searchParamsHandler";

export default function SongList() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { getSearchParam } = new SearchParamsHandler(searchParams);

  const filter = getSearchParam<string>(AlbumsSearchParams.MainFilter, "");
  const query = getSearchParam<string>(AlbumsSearchParams.Query, "");
  const artistId = getSearchParam<string>(AlbumsSearchParams.ArtistId, "");

  async function fetchSongs() {
    return getFavoriteSongs();
  }

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    useInfiniteQuery({
      queryKey: [queryKeys.song.all, filter, query, artistId],
      initialPageParam: 0,
      queryFn: fetchSongs,
      getNextPageParam: (lastPage) => lastPage.nextOffset,
    });

  const { data: songCountData, isLoading: songCountIsLoading } =
    useTotalFavorites();

  const songlist = data?.pages.flatMap((page) => page.songs) ?? [];
  const songCount = songCountData ?? 0;

  return (
    <SongListLayout
      title={t("sidebar.favorites")}
      songCount={songCount}
      songCountLoading={songCountIsLoading}
      songlist={songlist}
      isLoading={isLoading}
      isFetchingNextPage={isFetchingNextPage}
      fetchNextPage={fetchNextPage}
      hasNextPage={hasNextPage ?? false}
      sourceName={t("sidebar.favorites")}
    />
  );
}
