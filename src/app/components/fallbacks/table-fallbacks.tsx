import { cn } from "@/lib/utils";
import { Skeleton } from "@/app/components/ui/skeleton";

interface TableFallbackProps {
  variant?: "classic" | "modern";
  type?: "regular" | "infinity";
  length?: number;
  columns?: "songs" | "playlists" | "radios" | "artists";
}

function SongsHeaderCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <Skeleton className="w-36 h-5" />
      <Skeleton className="w-16 h-5 hidden lg:block" />
      <Skeleton className="w-12 h-5 hidden md:block" />
      <Skeleton className="w-12 h-5 hidden lg:block" />
      <Skeleton className="w-16 h-5 hidden 2xl:block" />
      <Skeleton className="w-14 h-5 rounded-full hidden 2xl:block" />
      <Skeleton className="w-5 h-5 ml-auto mr-2" />
    </>
  );
}

function SongsRowCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <div className="flex items-center gap-2">
        <Skeleton className="w-10 h-10" />
        <Skeleton className="w-36 h-5" />
      </div>
      <Skeleton className="w-36 h-5 hidden lg:block" />
      <Skeleton className="w-12 h-5 hidden md:block" />
      <Skeleton className="w-6 h-5 hidden lg:block" />
      <Skeleton className="w-20 h-5 hidden 2xl:block" />
      <Skeleton className="w-14 h-5 rounded-full hidden 2xl:block" />
      <div className="flex items-center justify-end gap-4 w-full">
        <Skeleton className="w-5 h-5 mr-2" />
      </div>
    </>
  );
}

function PlaylistsHeaderCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <Skeleton className="w-20 h-5" />
      <Skeleton className="w-20 h-5 hidden 2xl:block" />
      <Skeleton className="w-20 h-5" />
      <Skeleton className="w-12 h-5" />
      <Skeleton className="w-12 h-5" />
      <Skeleton className="w-5 h-5 ml-auto mr-2" />
    </>
  );
}

function PlaylistsRowCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <div className="flex items-center gap-2">
        <Skeleton className="w-10 h-10 rounded" />
        <Skeleton className="w-36 h-5" />
      </div>
      <Skeleton className="w-16 h-5 hidden 2xl:block" />
      <Skeleton className="w-12 h-5" />
      <Skeleton className="w-12 h-5" />
      <Skeleton className="w-12 h-5" />
      <div className="flex justify-end">
        <Skeleton className="w-5 h-5 mr-2" />
      </div>
    </>
  );
}

function RadiosHeaderCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <Skeleton className="w-20 h-5" />
      <Skeleton className="w-16 h-5" />
      <Skeleton className="w-12 h-5" />
      <Skeleton className="w-5 h-5 ml-auto mr-2" />
    </>
  );
}

function RadiosRowCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <Skeleton className="w-28 h-5" />
      <Skeleton className="w-24 h-5" />
      <Skeleton className="w-20 h-5" />
      <div className="flex justify-end">
        <Skeleton className="w-5 h-5 mr-2" />
      </div>
    </>
  );
}

function ArtistsHeaderCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <Skeleton className="w-20 h-5" />
      <Skeleton className="w-20 h-5 hidden md:block" />
      <Skeleton className="w-5 h-5 ml-auto mr-2" />
    </>
  );
}

function ArtistsRowCells() {
  return (
    <>
      <Skeleton className="w-5 h-5 ml-2" />
      <Skeleton className="w-28 h-5" />
      <Skeleton className="w-12 h-5 hidden md:block" />
      <div className="flex justify-end">
        <Skeleton className="w-5 h-5 mr-2" />
      </div>
    </>
  );
}

function getGridCols(columns: string) {
  switch (columns) {
    case "playlists":
      return "grid-cols-playlist-fallback";
    case "radios":
      return "grid-cols-radio-fallback";
    case "artists":
      return "grid-cols-artist-fallback";
    default:
      return "grid-cols-table-fallback";
  }
}

export function TableFallback({
  variant = "classic",
  type = "regular",
  length = 10,
  columns = "songs",
}: TableFallbackProps) {
  const isClassic = variant === "classic";
  const isModern = variant === "modern";
  const isRegular = type === "regular";

  const gridCols = getGridCols(columns);

  const HeaderCells =
    columns === "playlists"
      ? PlaylistsHeaderCells
      : columns === "radios"
        ? RadiosHeaderCells
        : columns === "artists"
          ? ArtistsHeaderCells
          : SongsHeaderCells;

  const RowCells =
    columns === "playlists"
      ? PlaylistsRowCells
      : columns === "radios"
        ? RadiosRowCells
        : columns === "artists"
          ? ArtistsRowCells
          : SongsRowCells;

  return (
    <div
      className={cn(
        "w-full",
        isClassic && "rounded-md bg-background border",
        isModern && "bg-transparent",
      )}
    >
      <div
        className={cn(
          gridCols,
          "px-2 items-center grid",
          isModern && "border-b border-foreground/20",
          isModern && isRegular && "mb-2",
          isRegular ? "h-12" : "h-[41px]",
        )}
      >
        <HeaderCells />
      </div>
      <div className={cn(isModern && "rounded-md")}>
        {Array.from({ length }).map((_, index) => (
          <div
            key={index}
            className={cn(
              gridCols,
              "p-2 items-center grid",
              isClassic && "border-b last:border-b-0",
              isModern && "rounded-md mb-1",
            )}
          >
            <RowCells />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TopSongsTableFallback() {
  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="w-28 h-8 rounded" />
        <Skeleton className="w-16 h-5 rounded" />
      </div>

      <TableFallback variant="modern" />
    </div>
  );
}
