import { RadioActionButton } from "@/app/components/radios/action-button";
import PlaySongButton from "@/app/components/table/play-button";
import { TableRadioTitle } from "@/app/components/table/radio-title";
import { DataTableColumnHeader } from "@/app/components/ui/data-table-column-header";
import {
  columnProps,
  getLayoutMap,
  radioColumnLayouts,
} from "@/app/tables/column-layouts";
import i18n from "@/i18n";
import { ColumnDefType } from "@/types/react-table/columnDef";
import { Radio } from "@/types/responses/radios";

export function radiosColumns(): ColumnDefType<Radio>[] {
  const layouts = getLayoutMap(radioColumnLayouts);

  return [
    {
      id: "index",
      accessorKey: "index",
      ...columnProps(layouts.index),
      header: () => {
        return <div className="w-full text-center">#</div>;
      },
      cell: ({ row }) => {
        const trackNumber = row.index + 1;
        const radio = row.original;

        return <PlaySongButton trackNumber={trackNumber} trackId={radio.id} />;
      },
    },
    {
      id: "name",
      accessorKey: "name",
      enableSorting: true,
      sortingFn: "customSortFn",
      ...columnProps(layouts.name),
      header: ({ column, table }) => (
        <DataTableColumnHeader column={column} table={table}>
          {i18n.t("radios.table.name")}
        </DataTableColumnHeader>
      ),
      cell: ({ row }) => <TableRadioTitle name={row.original.name} />,
    },
    {
      id: "homePageUrl",
      accessorKey: "homePageUrl",
      ...columnProps(layouts.homePageUrl),
      header: i18n.t("radios.table.homepage"),
      cell: ({ row }) => {
        const { homePageUrl } = row.original;

        if (!homePageUrl) return "";

        return (
          <div className="truncate">
            <p className="truncate text-primary">
              <a
                href={homePageUrl}
                target="_blank"
                rel="nofollow noreferrer"
                className="hover-supported:underline"
              >
                {homePageUrl}
              </a>
            </p>
          </div>
        );
      },
    },
    {
      id: "streamUrl",
      accessorKey: "streamUrl",
      ...columnProps(layouts.streamUrl),
      header: i18n.t("radios.table.stream"),
      cell: ({ row }) => (
        <div className="truncate">
          <p className="truncate">{row.original.streamUrl}</p>
        </div>
      ),
    },
    {
      id: "actions",
      accessorKey: "actions",
      ...columnProps(layouts.actions),
      header: "",
      cell: ({ row }) => {
        return <RadioActionButton row={row.original} />;
      },
    },
  ];
}
