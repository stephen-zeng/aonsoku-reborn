import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { MobileSongList } from "@/app/components/mobile/mobile-media-list";
import { DataTable } from "@/app/components/ui/data-table";
import { useHasHover } from "@/app/hooks/use-input-mode";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { songsColumns } from "@/app/tables/songs-columns";
import { ROUTES } from "@/routes/routesList";
import { usePlayerActions } from "@/store/player.store";
import { ColumnFilter } from "@/types/columnFilter";
import { IArtist } from "@/types/responses/artist";
import { ISong } from "@/types/responses/song";

interface TopSongsProps {
  topSongs: ISong[];
  artist: IArtist;
}

export default function ArtistTopSongs({ topSongs, artist }: TopSongsProps) {
  const { t } = useTranslation();
  const { setSongList } = usePlayerActions();
  const hasHover = useHasHover();
  const isMobile = useIsMobile();
  const columns = useMemo(
    () =>
      songsColumns({
        hasHover,
      }),
    [hasHover],
  );
  const topTenSongs = topSongs.length > 10 ? topSongs.slice(0, 10) : topSongs;
  const { id, name } = artist;

  const columnsToShow: ColumnFilter[] = [
    "index",
    "title",
    "album",
    "year",
    "duration",
    "playCount",
    "played",
    "contentType",
    "select",
  ];

  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("artist.topSongs")}
        </h3>

        <Link
          to={ROUTES.SONGS.ARTIST_TRACKS(id, name)}
          className="h-full"
          data-testid="view-all-tracks-link"
        >
          <p className="leading-7 text-sm truncate hover-supported:underline text-muted-foreground hover-supported:text-primary">
            {t("generic.viewAll")}
          </p>
        </Link>
      </div>

      {isMobile ? (
        <MobileSongList
          songs={topTenSongs}
          onPlaySong={(index) =>
            setSongList(topTenSongs, index, false, undefined, name)
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={topTenSongs}
          handlePlaySong={(row) =>
            setSongList(topTenSongs, row.index, false, undefined, name)
          }
          columnFilter={columnsToShow}
          variant="modern"
        />
      )}
    </div>
  );
}
