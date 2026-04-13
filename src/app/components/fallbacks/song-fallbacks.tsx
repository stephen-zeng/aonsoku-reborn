import { TableFallback } from "@/app/components/fallbacks/table-fallbacks";
import {
  AddButtonSkeleton,
  ShadowHeaderFallback,
} from "@/app/components/fallbacks/ui-fallbacks";
import { Skeleton } from "@/app/components/ui/skeleton";

export function InfinitySongListFallback() {
  return (
    <div className="w-full h-content">
      <ShadowHeaderFallback
        actions={
          <>
            <Skeleton className="w-8 h-8 rounded-md" />
            <Skeleton className="w-32 h-9 rounded-md" />
            <Skeleton className="w-8 h-8 rounded-md" />
            <Skeleton className="w-8 h-8 rounded-md" />
          </>
        }
      />

      <div className="w-full h-[calc(100%-80px)] overflow-auto">
        <TableFallback variant="modern" length={20} type="infinity" />
      </div>
    </div>
  );
}

export function PlaylistsListFallback() {
  return (
    <div className="w-full h-content">
      <ShadowHeaderFallback actions={<AddButtonSkeleton />} />

      <div className="w-full h-[calc(100%-80px)]">
        <TableFallback columns="playlists" />
      </div>
    </div>
  );
}

export function RadiosListFallback() {
  return (
    <div className="w-full h-content">
      <ShadowHeaderFallback actions={<AddButtonSkeleton />} />

      <div className="w-full h-[calc(100%-80px)]">
        <TableFallback columns="radios" length={5} />
      </div>
    </div>
  );
}

export function MobileLibraryFallback() {
  return (
    <div className="w-full px-4 py-6 flex flex-col gap-6">
      <Skeleton className="w-28 h-8" />

      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col items-center justify-center gap-2 rounded-xl bg-secondary p-4 flex-1 min-h-[80px]"
          >
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-12 h-4" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="w-24 h-6 px-1" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-1 py-2">
            <Skeleton className="w-10 h-10 rounded" />
            <Skeleton className="w-28 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ArtistsTableFallback() {
  return (
    <div className="w-full h-content">
      <ShadowHeaderFallback
        actions={<Skeleton className="w-9 h-9 rounded-md" />}
      />

      <div className="w-full h-[calc(100%-80px)]">
        <TableFallback columns="artists" />
      </div>
    </div>
  );
}
