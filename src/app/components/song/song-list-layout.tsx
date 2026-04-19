import { type ReactNode, useCallback, useMemo, useRef } from "react";
import type { Row } from "@tanstack/react-table";
import { ShadowHeader } from "@/app/components/album/shadow-header";
import { InfinitySongListFallback } from "@/app/components/fallbacks/song-fallbacks";
import { HeaderTitle } from "@/app/components/header-title";
import { DataTableList } from "@/app/components/ui/data-table-list";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { useIsMobile } from "@/app/hooks/use-mobile";
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
  noRowsMessage?: string;
  sourceName?: string;
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
  noRowsMessage,
  sourceName,
}: SongListLayoutProps) {
  const { setSongList } = usePlayerActions();
  const isMobile = useIsMobile();
  const hasHover = useHasHover();
  const songlistRef = useRef(songlist);
  songlistRef.current = songlist;
  const sourceNameRef = useRef(sourceName);
  sourceNameRef.current = sourceName;
  const columns = useMemo(
    () =>
      songsColumns({
        disableTextNavigation: true,
        hasHover,
      }),
    [hasHover],
  );
  const columnsToShow = isMobile ? COLUMNS_MOBILE : COLUMNS_DESKTOP;

  const handlePlaySong = useCallback(
    (row: Row<ISong>) => {
      setSongList(
        songlistRef.current,
        row.index,
        false,
        undefined,
        sourceNameRef.current,
      );
    },
    [setSongList],
  );

  if (isLoading && !isFetchingNextPage) {
    return <InfinitySongListFallback />;
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
          handlePlaySong={handlePlaySong}
          columnFilter={columnsToShow}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          noRowsMessage={noRowsMessage}
        />
      </div>
    </div>
  );
}
