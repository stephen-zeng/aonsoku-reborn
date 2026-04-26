import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { Row } from "@tanstack/react-table";
import ImageHeader from "@/app/components/album/image-header";
import {
  FavoritesButtons,
  FavoritesIcon,
} from "@/app/components/favorites/buttons";
import { BadgesData } from "@/app/components/header-info";
import ListWrapper from "@/app/components/list-wrapper";
import { DataTable } from "@/app/components/ui/data-table";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { songsColumns } from "@/app/tables/songs-columns";
import { subsonic } from "@/service/subsonic";
import { usePlayerActions } from "@/store/player.store";
import { ColumnFilter } from "@/types/columnFilter";
import { ISong } from "@/types/responses/song";
import { convertSecondsToHumanRead } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";

const COLUMNS_DESKTOP: ColumnFilter[] = [
  "title",
  "album",
  "duration",
  "playCount",
  "contentType",
  "select",
];
const COLUMNS_MOBILE: ColumnFilter[] = ["title", "select"];

export default function SongList() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const hasHover = useHasHover();
  const { setSongList } = usePlayerActions();

  const columns = useMemo(
    () => songsColumns({ disableTextNavigation: true, hasHover }),
    [hasHover],
  );

  const {
    data: songs,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [queryKeys.favorites.list],
    queryFn: async () => {
      const response = await subsonic.songs.getFavoriteSongs();
      return response?.song ?? [];
    },
  });

  const songlist = useMemo(() => songs ?? [], [songs]);

  const { songCountText, durationText } = useMemo(() => {
    if (!songlist.length) return { songCountText: null, durationText: null };
    const totalDuration = songlist.reduce(
      (acc, song) => acc + (song.duration ?? 0),
      0,
    );
    return {
      songCountText: t("favorites.songCount", { count: songlist.length }),
      durationText: t("favorites.duration", {
        duration: convertSecondsToHumanRead(totalDuration),
      }),
    };
  }, [songlist, t]);

  const badges = useMemo<BadgesData>(
    () => [
      { content: songCountText, type: "text" as const },
      { content: durationText, type: "text" as const },
    ],
    [songCountText, durationText],
  );

  const columnsToShow = isMobile ? COLUMNS_MOBILE : COLUMNS_DESKTOP;

  const songlistRef = useRef(songlist);
  songlistRef.current = songlist;
  const sourceName = t("sidebar.favorites");
  const sourceNameRef = useRef(sourceName);
  sourceNameRef.current = sourceName;

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

  const customIcon = useMemo(() => <FavoritesIcon />, []);

  if (isLoading) {
    return null;
  }

  if (isError) {
    return null;
  }

  return (
    <div className="w-full">
      <ImageHeader
        type={t("favorites.headline")}
        title={t("sidebar.favorites")}
        badges={badges}
        coverArtType="album"
        coverArtSize="700"
        coverArtAlt={t("sidebar.favorites")}
        customIcon={customIcon}
        showSimpleSubtitle
      />

      <ListWrapper>
        <FavoritesButtons songs={songlist} sourceName={sourceName} />

        <DataTable
          columns={columns}
          data={songlist}
          handlePlaySong={handlePlaySong}
          columnFilter={columnsToShow}
          noRowsMessage={t("favorites.noSongs")}
          variant="modern"
        />
      </ListWrapper>
    </div>
  );
}
