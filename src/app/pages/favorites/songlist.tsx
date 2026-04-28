import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Row } from "@tanstack/react-table";
import ImageHeader from "@/app/components/album/image-header";
import {
  FavoritesButtons,
  FavoritesIcon,
} from "@/app/components/favorites/buttons";
import { FavoritesFallback } from "@/app/components/fallbacks/song-fallbacks";
import { BadgesData } from "@/app/components/header-info";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import ListWrapper from "@/app/components/list-wrapper";
import { DataTable } from "@/app/components/ui/data-table";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { songsColumns } from "@/app/tables/songs-columns";
import { offlineData, useOfflineQuery } from "@/lib/offlineQueryClient";
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

async function fetchFavoriteSongs() {
  const response = await subsonic.songs.getFavoriteSongs();
  return response?.song ?? [];
}

async function fetchOfflineFavoriteSongs() {
  const songs = await offlineData.songs();
  return songs.filter((song) => song.starred != null);
}

export default function SongList() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const hasHover = useHasHover();
  const { setSongList } = usePlayerActions();
  const [accentColor, setAccentColor] = useState("");

  const columns = useMemo(() => songsColumns({ hasHover }), [hasHover]);

  const {
    data: songs,
    isLoading,
    isError,
  } = useOfflineQuery([...queryKeys.favorites.list], fetchFavoriteSongs, {
    offlineFn: fetchOfflineFavoriteSongs,
    staleTime: 5 * 60 * 1000,
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
    return <FavoritesFallback />;
  }

  if (isError) {
    return null;
  }

  return (
    <div className="w-full">
      <MobilePageHeader variant="sub" title={t("sidebar.favorites")} accentColor={accentColor} />
      <ImageHeader
        type={t("favorites.headline")}
        title={t("sidebar.favorites")}
        badges={badges}
        coverArtType="album"
        coverArtSize="700"
        coverArtAlt={t("sidebar.favorites")}
        customIcon={customIcon}
        showSimpleSubtitle
        onColorExtracted={setAccentColor}
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
