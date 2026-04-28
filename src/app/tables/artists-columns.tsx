import { memo } from "react";
import { ArtistTitle } from "@/app/components/table/artist-title.tsx";
import { TableLikeButton } from "@/app/components/table/like-button";
import PlaySongButton from "@/app/components/table/play-button";
import { DataTableColumnHeader } from "@/app/components/ui/data-table-column-header";
import {
  artistColumnLayouts,
  columnProps,
  getLayoutMap,
} from "@/app/tables/column-layouts";
import i18n from "@/i18n";
import { ColumnDefType } from "@/types/react-table/columnDef";
import { ISimilarArtist } from "@/types/responses/artist";

const MemoArtistTitle = memo(ArtistTitle);
const MemoPlaySongButton = memo(PlaySongButton);
const MemoDataTableColumnHeader = memo(
  DataTableColumnHeader,
) as typeof DataTableColumnHeader;
const MemoTableLikeButton = memo(TableLikeButton);

export function artistsColumns(): ColumnDefType<ISimilarArtist>[] {
  const layouts = getLayoutMap(artistColumnLayouts);

  return [
    {
      id: "index",
      accessorKey: "index",
      ...columnProps(layouts.index),
      header: () => {
        return <div className="w-full text-center">#</div>;
      },
      cell: ({ row }) => {
        const index = row.index + 1;
        const artist = row.original;

        return <MemoPlaySongButton trackNumber={index} trackId={artist.id} />;
      },
    },
    {
      id: "name",
      accessorKey: "name",
      enableSorting: true,
      sortingFn: "customSortFn",
      ...columnProps(layouts.name),
      header: ({ column, table }) => (
        <MemoDataTableColumnHeader column={column} table={table}>
          {i18n.t("table.columns.name")}
        </MemoDataTableColumnHeader>
      ),
      cell: ({ row }) => <MemoArtistTitle artist={row.original} />,
    },
    {
      id: "albumCount",
      accessorKey: "albumCount",
      enableSorting: true,
      sortingFn: "basic",
      ...columnProps(layouts.albumCount),
      header: ({ column, table }) => (
        <MemoDataTableColumnHeader column={column} table={table}>
          {i18n.t("table.columns.albumCount")}
        </MemoDataTableColumnHeader>
      ),
    },
    {
      id: "starred",
      accessorKey: "starred",
      header: "",
      ...columnProps(layouts.starred),
      cell: ({ row }) => {
        const { starred, id } = row.original;

        return (
          <MemoTableLikeButton
            type="artist"
            entityId={id}
            starred={typeof starred === "string"}
          />
        );
      },
    },
  ];
}
