import {
  HeaderWithImageEffect,
  MobileSongListFallback,
} from "@/app/components/fallbacks/album-fallbacks";
import { TableFallback } from "@/app/components/fallbacks/table-fallbacks";
import {
  AddButtonSkeleton,
  ButtonsBarFallback,
  ShadowHeaderFallback,
} from "@/app/components/fallbacks/ui-fallbacks";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import ListWrapper from "@/app/components/list-wrapper";
import { Skeleton } from "@/app/components/ui/skeleton";
import { songCollectionColumnIds } from "@/app/tables/column-layouts";

function MobileListHeaderFallback() {
  return (
    <div className="flex flex-col">
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <Skeleton id="detail-page-title" className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="size-10 rounded-md" />
          <Skeleton className="size-10 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function MobileSongsListFallback() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2">
          <Skeleton className="size-12 rounded shadow shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="size-10 rounded-md" />
        </div>
      ))}
    </div>
  );
}

function MobileArtistsListFallback() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2">
          <Skeleton className="size-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="size-9 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function InfinitySongListFallback() {
  return (
    <>
      <div className="w-full flex flex-col md:hidden">
        <MobilePageHeader
          variant="sub"
          title=""
          transparentTheme="default"
        />
        <MobileListHeaderFallback />
        <MobileSongsListFallback />
      </div>
      <div className="w-full h-content hidden md:block">
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
    </>
  );
}

export function PlaylistsListFallback() {
  return (
    <div className="w-full h-content">
      <ShadowHeaderFallback actions={<AddButtonSkeleton />} />

      <div className="w-full h-[calc(100%-80px)] overflow-auto">
        <TableFallback columns="playlists" variant="modern" type="infinity" />
      </div>
    </div>
  );
}

export function RadiosListFallback() {
  return (
    <div className="w-full h-content">
      <ShadowHeaderFallback actions={<AddButtonSkeleton />} />

      <div className="w-full h-[calc(100%-80px)] overflow-auto">
        <TableFallback
          columns="radios"
          variant="modern"
          type="infinity"
          length={5}
        />
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
    <>
      <div className="w-full flex flex-col md:hidden">
        <MobilePageHeader
          variant="sub"
          title=""
          transparentTheme="default"
        />
        <MobileListHeaderFallback />
        <MobileArtistsListFallback />
      </div>
      <div className="w-full h-content hidden md:block">
        <ShadowHeaderFallback
          actions={<Skeleton className="w-9 h-9 rounded-md" />}
        />

        <div className="w-full h-[calc(100%-80px)] overflow-auto">
          <TableFallback
            columns="artists"
            variant="modern"
            type="infinity"
          />
        </div>
      </div>
    </>
  );
}

function FavoritesButtonsFallback() {
  return (
    <ButtonsBarFallback>
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14" />
      <Skeleton className="rounded-full w-14 h-14 md:order-first" />
    </ButtonsBarFallback>
  );
}

export function FavoritesFallback() {
  return (
    <div className="w-full bg-background min-h-content">
      <MobilePageHeader variant="sub" title="" showSpacer={false} />
      <HeaderWithImageEffect />

      <ListWrapper>
        <FavoritesButtonsFallback />
        <div className="md:hidden">
          <MobileSongListFallback />
        </div>
        <div className="hidden md:block">
          <TableFallback
            variant="modern"
            length={20}
            columnIds={songCollectionColumnIds}
          />
        </div>
      </ListWrapper>
    </div>
  );
}
