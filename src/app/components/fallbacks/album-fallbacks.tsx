import { ImageHeaderEffect } from "@/app/components/album/header-effect";
import { IMAGE_HEADER_MAIN_GRADIENT } from "@/app/components/album/image-header-gradients";
import { TableFallback } from "@/app/components/fallbacks/table-fallbacks";
import {
  CardSkeleton,
  DetailButtonsFallback,
  ShadowHeaderFallback,
} from "@/app/components/fallbacks/ui-fallbacks";
import ListWrapper from "@/app/components/list-wrapper";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ArtistAboveCoverFallback() {
  return (
    <div className="md:hidden flex justify-center items-center gap-2">
      <Skeleton className="w-6 h-6 rounded-full" />
      <Skeleton className="h-4 w-20 rounded" />
    </div>
  );
}

export function AlbumHeaderFallback({
  showSecondaryBadges = false,
  showArtistAboveCover = false,
}: {
  showSecondaryBadges?: boolean;
  showArtistAboveCover?: boolean;
}) {
  return (
    <div
      className={cn(
        IMAGE_HEADER_MAIN_GRADIENT,
        "w-full px-3 py-3 md:px-8 md:py-6 bg-muted-foreground flex flex-col gap-2 md:gap-4 relative md:absolute md:inset-0",
      )}
    >
      {showArtistAboveCover && <ArtistAboveCoverFallback />}

      <div className="flex flex-col items-center md:flex-row md:items-center w-full gap-3 md:gap-6 lg:gap-8">
        <Skeleton className="rounded shadow-header-image w-[200px] h-[200px] min-w-[200px] min-h-[200px] 2xl:w-[250px] 2xl:h-[250px] 2xl:min-w-[250px] 2xl:min-h-[250px] aspect-square" />
        <div className="flex w-full items-center flex-col md:items-start md:max-w-[calc(100%-216px)] 2xl:max-w-[calc(100%-266px)] md:justify-end">
          <Skeleton className="text-[10px] md:text-xs 2xl:text-sm h-3 md:h-4 2xl:h-5 w-16 mb-2" />
          <Skeleton className="h-6 md:h-12 w-[200px] md:w-[260px] mb-2" />

          <div className="hidden md:flex flex-wrap items-center gap-2 mt-1 md:mt-2 justify-center md:justify-start text-sm">
            <Skeleton className="h-[22px] w-12 rounded-full" />
            <Skeleton className="h-[22px] w-12 rounded-full" />
            {showSecondaryBadges && (
              <>
                <Skeleton className="h-[22px] w-3 rounded-full" />
                <Skeleton className="h-[22px] w-16 rounded-full" />
                <Skeleton className="h-[22px] w-20 rounded-full" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="md:hidden flex flex-col items-center text-sm">
        {!showArtistAboveCover && (
          <Skeleton className="h-3 w-24 rounded mb-1 opacity-80" />
        )}
        <div className="flex flex-wrap justify-center gap-1">
          <Skeleton className="h-[22px] w-12 rounded-full" />
          <Skeleton className="h-[22px] w-12 rounded-full" />
          {showSecondaryBadges && (
            <>
              <Skeleton className="h-[22px] w-3 rounded-full" />
              <Skeleton className="h-[22px] w-16 rounded-full" />
            </>
          )}
        </div>
        {showSecondaryBadges && (
          <div className="flex flex-wrap justify-center gap-1">
            <Skeleton className="h-[22px] w-12 rounded-full" />
            <Skeleton className="h-[22px] w-20 rounded-full" />
          </div>
        )}
      </div>
    </div>
  );
}

export function HeaderWithImageEffect({
  showSecondaryBadges = false,
  showArtistAboveCover = false,
}: {
  showSecondaryBadges?: boolean;
  showArtistAboveCover?: boolean;
}) {
  return (
    <div className="flex flex-col relative w-full">
      <div className="relative w-full h-auto md:h-[calc(3rem+200px)] 2xl:h-[calc(3rem+250px)]">
        <AlbumHeaderFallback
          showSecondaryBadges={showSecondaryBadges}
          showArtistAboveCover={showArtistAboveCover}
        />
        <ImageHeaderEffect className="bg-muted-foreground" />
      </div>
    </div>
  );
}

function PlayButtonsFallback() {
  return <DetailButtonsFallback />;
}

function AlbumInfoFallback() {
  return (
    <div className="flex flex-wrap gap-2 items-center text-sm">
      <Skeleton className="w-12 h-4 rounded-full" />
      <Skeleton className="w-12 h-4 rounded-full" />
    </div>
  );
}

export function AlbumFallback() {
  return (
    <div className="w-full bg-background min-h-content">
      <HeaderWithImageEffect showSecondaryBadges showArtistAboveCover />
      <ListWrapper>
        <PlayButtonsFallback />
        <AlbumInfoFallback />
        <TableFallback variant="modern" />
      </ListWrapper>
    </div>
  );
}

export function AlbumsFallback() {
  return (
    <div className="w-full h-content">
      <ShadowHeaderFallback
        actions={
          <div className="flex gap-2">
            <Skeleton className="w-8 h-8 rounded-md" />
            <Skeleton className="w-32 h-9 rounded-md" />
          </div>
        }
      />

      <ListWrapper className="pt-shadow-header-distance px-0">
        <GridFallback />
      </ListWrapper>
    </div>
  );
}

function GridFallback() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-4">
      {Array.from({ length: 16 }).map((_, index) => (
        <CardSkeleton key={"card-fallback-" + index} />
      ))}
    </div>
  );
}
