import type { Row } from "@tanstack/react-table";
import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { ShadowHeader } from "@/app/components/album/shadow-header";
import { InfinitySongListFallback } from "@/app/components/fallbacks/song-fallbacks";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import { HeaderTitle } from "@/app/components/header-title";
import { MobileSongList } from "@/app/components/mobile/mobile-media-list";
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

  const handlePlaySongIndex = useCallback(
    (index: number) => {
      setSongList(
        songlistRef.current,
        index,
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

  if (isMobile) {
    return (
      <div className="w-full">
        <MobilePageHeader variant="root" title={title} />
        <div className="flex flex-col gap-4 px-4">
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {songCountLoading ? "" : songCount}
            </span>
            {headerActions && (
              <div className="flex flex-1 flex-wrap justify-end gap-2">
                {headerActions}
              </div>
            )}
          </div>
          <MobileSongList
            songs={songlist}
            onPlaySong={handlePlaySongIndex}
            emptyMessage={noRowsMessage}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-content">
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

      <div className="w-full">
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
