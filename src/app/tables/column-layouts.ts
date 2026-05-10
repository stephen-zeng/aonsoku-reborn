import type { CSSProperties } from "react";
import type { ColumnDefType } from "@/types/react-table/columnDef";

export type TableKind = "songs" | "playlists" | "radios" | "artists";

export type TableColumnId =
  | "index"
  | "trackNumber"
  | "title"
  | "name"
  | "artist"
  | "album"
  | "albumCount"
  | "year"
  | "duration"
  | "playCount"
  | "played"
  | "bpm"
  | "bitRate"
  | "contentType"
  | "starred"
  | "select"
  | "remove"
  | "comment"
  | "songCount"
  | "public"
  | "actions"
  | "homePageUrl"
  | "streamUrl";

export type SkeletonCellType =
  | "index"
  | "songTitle"
  | "mediaTitle"
  | "text"
  | "icon"
  | "badge"
  | "action"
  | "empty";

export interface TableColumnLayout {
  id: TableColumnId;
  style?: CSSProperties;
  className?: string;
  skeleton: SkeletonCellType;
  headerSkeleton?: SkeletonCellType;
  headerWidth?: string;
  rowWidth?: string;
}

export const songListColumnIds = [
  "index",
  "title",
  "album",
  "duration",
  "playCount",
  "played",
  "contentType",
  "select",
] as const satisfies readonly TableColumnId[];

export const songDetailColumnIds = [
  "trackNumber",
  "title",
  "duration",
  "playCount",
  "played",
  "bitRate",
  "contentType",
  "select",
] as const satisfies readonly TableColumnId[];

export const songCollectionColumnIds = [
  "title",
  "album",
  "duration",
  "playCount",
  "contentType",
  "select",
] as const satisfies readonly TableColumnId[];

export const topSongsColumnIds = [
  "index",
  "title",
  "album",
  "year",
  "duration",
  "playCount",
  "played",
  "contentType",
  "select",
] as const satisfies readonly TableColumnId[];

export const artistMobileColumnIds = [
  "index",
  "name",
  "starred",
] as const satisfies readonly TableColumnId[];

export const defaultColumnIdsByKind = {
  songs: songListColumnIds,
  playlists: [
    "index",
    "name",
    "comment",
    "songCount",
    "duration",
    "public",
    "actions",
  ],
  radios: ["index", "name", "homePageUrl", "streamUrl", "actions"],
  artists: ["index", "name", "albumCount", "starred"],
} as const satisfies Record<TableKind, readonly TableColumnId[]>;

export function columnProps<TData, TValue = unknown>(
  layout: TableColumnLayout | undefined,
): Pick<ColumnDefType<TData, TValue>, "style" | "className"> {
  return {
    className: layout?.className,
    style: layout?.style,
  };
}

export function getLayoutMap(layouts: readonly TableColumnLayout[]) {
  return Object.fromEntries(
    layouts.map((layout) => [layout.id, layout]),
  ) as Partial<Record<TableColumnId, TableColumnLayout>>;
}

export function getColumnLayouts({
  kind,
  hasHover = true,
  columnIds,
}: {
  kind: TableKind;
  hasHover?: boolean;
  columnIds?: readonly TableColumnId[];
}) {
  const layouts =
    kind === "songs"
      ? getSongColumnLayouts({ hasHover })
      : kind === "playlists"
        ? playlistColumnLayouts
        : kind === "radios"
          ? radioColumnLayouts
          : artistColumnLayouts;

  const ids = columnIds ?? defaultColumnIdsByKind[kind];
  return ids
    .map((id) => layouts.find((layout) => layout.id === id))
    .filter((layout): layout is TableColumnLayout => layout !== undefined);
}

export function getSongColumnLayouts({
  hasHover = true,
}: {
  hasHover?: boolean;
} = {}): TableColumnLayout[] {
  return [
    {
      id: "index",
      style: {
        width: 48,
        minWidth: "48px",
      },
      skeleton: "index",
      headerWidth: "w-3",
    },
    {
      id: "trackNumber",
      style: {
        width: 48,
        minWidth: "48px",
      },
      skeleton: "index",
      headerWidth: "w-3",
    },
    {
      id: "title",
      style: {
        flex: 1,
        minWidth: 120,
      },
      skeleton: "songTitle",
      headerWidth: "w-20",
    },
    {
      id: "artist",
      style: {
        width: "20%",
        maxWidth: "20%",
      },
      skeleton: "text",
      headerWidth: "w-16",
      rowWidth: "w-28 max-w-full",
    },
    {
      id: "album",
      style: {
        width: "24%",
        minWidth: "14%",
        maxWidth: "24%",
      },
      className: "hidden lg:flex",
      skeleton: "text",
      headerWidth: "w-16",
      rowWidth: "w-36 max-w-full",
    },
    {
      id: "year",
      style: {
        width: 80,
        maxWidth: 80,
      },
      skeleton: "text",
      headerWidth: "w-10",
      rowWidth: "w-10",
    },
    {
      id: "duration",
      style: {
        width: 80,
        maxWidth: 80,
      },
      className: "hidden md:flex",
      skeleton: "text",
      headerSkeleton: "icon",
      rowWidth: "w-10",
    },
    {
      id: "playCount",
      style: {
        width: 140,
        maxWidth: 140,
      },
      className: "hidden lg:flex",
      skeleton: "text",
      headerWidth: "w-12",
      rowWidth: "w-6",
    },
    {
      id: "played",
      style: {
        width: 180,
        maxWidth: 180,
      },
      className: "hidden 2xl:flex",
      skeleton: "text",
      headerWidth: "w-16",
      rowWidth: "w-20",
    },
    {
      id: "bpm",
      style: {
        width: 80,
        maxWidth: 80,
      },
      skeleton: "text",
      headerWidth: "w-10",
      rowWidth: "w-8",
    },
    {
      id: "bitRate",
      style: {
        width: 140,
        maxWidth: 140,
      },
      className: "hidden 2xl:flex",
      skeleton: "text",
      headerWidth: "w-16",
      rowWidth: "w-16",
    },
    {
      id: "contentType",
      style: {
        width: 100,
        maxWidth: 110,
      },
      className: "hidden 2xl:flex",
      skeleton: "badge",
      headerWidth: "w-14",
      rowWidth: "w-14",
    },
    {
      id: "select",
      style: {
        width: hasHover ? 120 : 48,
        maxWidth: hasHover ? 120 : 48,
        justifyContent: "end",
      },
      skeleton: "action",
      headerSkeleton: hasHover ? "icon" : "empty",
    },
    {
      id: "remove",
      style: {
        width: 48,
        maxWidth: 48,
        justifyContent: "end",
      },
      skeleton: "action",
      headerSkeleton: "empty",
    },
  ];
}

export const playlistColumnLayouts = [
  {
    id: "index",
    style: {
      width: 48,
      minWidth: "48px",
    },
    skeleton: "index",
    headerWidth: "w-3",
  },
  {
    id: "name",
    style: {
      flex: 1,
      minWidth: 250,
    },
    skeleton: "mediaTitle",
    headerWidth: "w-20",
    rowWidth: "w-36 max-w-[70%]",
  },
  {
    id: "comment",
    style: {
      width: "25%",
      maxWidth: "25%",
      marginRight: "1rem",
    },
    className: "hidden 2xl:flex",
    skeleton: "text",
    headerWidth: "w-20",
    rowWidth: "w-32 max-w-full",
  },
  {
    id: "songCount",
    style: {
      width: 190,
      maxWidth: 190,
    },
    skeleton: "text",
    headerWidth: "w-20",
    rowWidth: "w-12",
  },
  {
    id: "duration",
    style: {
      width: 100,
      maxWidth: 100,
    },
    skeleton: "text",
    headerSkeleton: "icon",
    rowWidth: "w-12",
  },
  {
    id: "public",
    style: {
      width: 100,
      maxWidth: 100,
    },
    skeleton: "icon",
    headerWidth: "w-12",
  },
  {
    id: "actions",
    style: {
      width: 48,
      maxWidth: 48,
      justifyContent: "end",
    },
    skeleton: "action",
    headerSkeleton: "empty",
  },
] as const satisfies readonly TableColumnLayout[];

export const radioColumnLayouts = [
  {
    id: "index",
    style: {
      width: 48,
      minWidth: "48px",
    },
    skeleton: "index",
    headerWidth: "w-3",
  },
  {
    id: "name",
    style: {
      flex: 1,
      minWidth: 250,
    },
    skeleton: "mediaTitle",
    headerWidth: "w-20",
    rowWidth: "w-28 max-w-[70%]",
  },
  {
    id: "homePageUrl",
    style: {
      width: "25%",
      maxWidth: "25%",
    },
    skeleton: "text",
    headerWidth: "w-16",
    rowWidth: "w-24 max-w-full",
  },
  {
    id: "streamUrl",
    style: {
      width: "25%",
      maxWidth: "25%",
      marginRight: "1rem",
    },
    skeleton: "text",
    headerWidth: "w-12",
    rowWidth: "w-20 max-w-full",
  },
  {
    id: "actions",
    style: {
      width: 48,
      maxWidth: 48,
      justifyContent: "end",
    },
    skeleton: "action",
    headerSkeleton: "empty",
  },
] as const satisfies readonly TableColumnLayout[];

export const artistColumnLayouts = [
  {
    id: "index",
    style: {
      width: 48,
      minWidth: "48px",
    },
    skeleton: "index",
    headerWidth: "w-3",
  },
  {
    id: "name",
    style: {
      flex: 1,
      minWidth: 100,
    },
    skeleton: "mediaTitle",
    headerWidth: "w-20",
    rowWidth: "w-28 max-w-[70%]",
  },
  {
    id: "albumCount",
    style: {
      width: "15%",
      maxWidth: "15%",
    },
    skeleton: "text",
    headerWidth: "w-20",
    rowWidth: "w-12",
  },
  {
    id: "starred",
    style: {
      width: 48,
      maxWidth: 48,
      justifyContent: "end",
    },
    skeleton: "action",
    headerSkeleton: "empty",
  },
] as const satisfies readonly TableColumnLayout[];
