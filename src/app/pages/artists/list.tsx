import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ShadowHeader } from "@/app/components/album/shadow-header";
import { ArtistGridCard } from "@/app/components/artist/artist-grid-card";
import { ArtistsFallback } from "@/app/components/fallbacks/artists.tsx";
import { GridViewWrapper } from "@/app/components/grid-view-wrapper";
import { HeaderTitle } from "@/app/components/header-title";
import ListWrapper from "@/app/components/list-wrapper";
import { MainViewTypeSelector } from "@/app/components/main-grid";
import { DataTableList } from "@/app/components/ui/data-table-list";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useSongList } from "@/app/hooks/use-song-list";
import { artistsColumns } from "@/app/tables/artists-columns";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
import { subsonic } from "@/service/subsonic";
import { useAppArtistsViewType } from "@/store/app.store";
import { usePlayerActions } from "@/store/player.store";
import { ColumnFilter } from "@/types/columnFilter";
import { ISimilarArtist } from "@/types/responses/artist";
import { queryKeys } from "@/utils/queryKeys";

const MemoShadowHeader = memo(ShadowHeader);
const MemoHeaderTitle = memo(HeaderTitle);
const MemoViewTypeSelector = memo(MainViewTypeSelector);
const MemoDataTableList = memo(DataTableList) as typeof DataTableList;
const MemoListWrapper = memo(ListWrapper);

export default function ArtistsList() {
  const { t } = useTranslation();
  const { getArtistAllSongs } = useSongList();
  const { setSongList } = usePlayerActions();
  const isMobile = useIsMobile();
  const {
    artistsPageViewType,
    setArtistsPageViewType,
    isTableView,
    isGridView,
  } = useAppArtistsViewType();

  const columns = artistsColumns();
  const artistColumnFilter: ColumnFilter[] | undefined = isMobile
    ? (["index", "name", "starred"] as ColumnFilter[])
    : undefined;

  const { data: artists, isLoading } = useOfflineQuery(
    [...queryKeys.artist.all],
    subsonic.artists.getAll,
    { offlineFn: offlineData.artists },
  );

  async function handlePlayArtistRadio(artist: ISimilarArtist) {
    const songList = await getArtistAllSongs(artist.name);

    if (songList) setSongList(songList, 0, false, undefined, artist.name);
  }

  if (isLoading) return <ArtistsFallback />;
  if (!artists) return null;

  return (
    <div className="w-full min-h-content">
      <MemoShadowHeader
        showGlassEffect={false}
        fixed={false}
        className="relative w-full justify-between items-center"
      >
        <MemoHeaderTitle title={t("sidebar.artists")} count={artists.length} />

        <MemoViewTypeSelector
          viewType={artistsPageViewType}
          setView_type={setArtistsPageViewType}
        />
      </MemoShadowHeader>

      {isTableView && (
        <div className="w-full">
          <MemoDataTableList
            columns={columns}
            data={artists}
            handlePlaySong={(row) => handlePlayArtistRadio(row.original)}
            columnFilter={artistColumnFilter}
            allowRowSelection={false}
            dataType="artist"
          />
        </div>
      )}

      {isGridView && (
        <MemoListWrapper className="pt-shadow-header-distance px-0">
          <GridViewWrapper
            list={artists}
            data-testid="artists-grid"
            type="artists"
          >
            {(artist) => <ArtistGridCard artist={artist} />}
          </GridViewWrapper>
        </MemoListWrapper>
      )}
    </div>
  );
}
