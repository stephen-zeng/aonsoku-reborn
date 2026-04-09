import { type ReactNode, useMemo } from "react";
import { isMobile } from "react-device-detect";
import { ShadowHeader } from "@/app/components/album/shadow-header";
import { InfinitySongListFallback } from "@/app/components/fallbacks/song-fallbacks";
import { HeaderTitle } from "@/app/components/header-title";
import { DataTableList } from "@/app/components/ui/data-table-list";
import { songsColumns } from "@/app/tables/songs-columns";
import { usePlayerActions } from "@/store/player.store";
import { ColumnFilter } from "@/types/columnFilter";
import { ISong } from "@/types/responses/song";

const COLUMNS_DESKTOP: ColumnFilter[] = [
  "index",
  "title",
  "album",
  "duration",
  "playCount",
  "played",
  "contentType",
  "select",
];

const COLUMNS_MOBILE: ColumnFilter[] = ["index", "title", "select"];

interface SongListLayoutProps {
  title: string;
  songCount: number;
  songCountLoading: boolean;
  songlist: ISong[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  headerActions?: ReactNode;
}

export function SongListLayout({
  title,
  songCount,
  songCountLoading,
  songlist,
  isLoading,
  isFetchingNextPage,
  fetchNextPage,
  hasNextPage,
  headerActions,
}: SongListLayoutProps) {
  const { setSongList } = usePlayerActions();
  const columns = useMemo(() => songsColumns(), []);
  const columnsToShow = isMobile ? COLUMNS_MOBILE : COLUMNS_DESKTOP;

  if (isLoading && !isFetchingNextPage) {
    return <InfinitySongListFallback />;
  }

  function handlePlaySong(index: number) {
    setSongList(songlist, index);
  }

  return (
    <div className="w-full h-content">
      <ShadowHeader
        showGlassEffect={false}
        fixed={false}
        className="relative w-full justify-between items-center"
      >
        <HeaderTitle
          title={title}
          count={songCount}
          loading={songCountLoading}
        />

        {headerActions && (
          <div className="flex gap-2 flex-1 justify-end flex-wrap">
            {headerActions}
          </div>
        )}
      </ShadowHeader>

      <div className="w-full h-[calc(100%-80px)] overflow-auto">
        <DataTableList
          columns={columns}
          data={songlist}
          handlePlaySong={(row) => handlePlaySong(row.index)}
          columnFilter={columnsToShow}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
        />
      </div>
    </div>
  );
}
