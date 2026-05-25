import { ImageHeaderEffect } from "@/app/components/album/header-effect";
import { IMAGE_HEADER_MAIN_GRADIENT } from "@/app/components/album/image-header-gradients";
import { TableFallback } from "@/app/components/fallbacks/table-fallbacks";
import {
  CardSkeleton,
  DetailButtonsFallback,
  ShadowHeaderFallback,
} from "@/app/components/fallbacks/ui-fallbacks";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import ListWrapper from "@/app/components/list-wrapper";
import { Skeleton } from "@/app/components/ui/skeleton";
import { songDetailColumnIds } from "@/app/tables/column-layouts";
import { cn } from "@/lib/utils";

interface HeaderContentProps {
  showSecondaryBadges?: boolean;
  showArtistAboveCover?: boolean;
  showMobileSubtitle?: boolean;
}

const defaultHeaderContentProps: Required<HeaderContentProps> = {
  showSecondaryBadges: false,
  showArtistAboveCover: false,
  showMobileSubtitle: true,
};

function ArtistAboveCoverFallback() {
  return (
    <div className="md:hidden flex justify-center items-center gap-2">
      <Skeleton className="w-6 h-6 rounded-full" />
      <Skeleton className="h-4 w-20 rounded" />
    </div>
  );
}

function AlbumHeaderContent({
  showSecondaryBadges = defaultHeaderContentProps.showSecondaryBadges,
  showArtistAboveCover = defaultHeaderContentProps.showArtistAboveCover,
  showMobileSubtitle = defaultHeaderContentProps.showMobileSubtitle,
}: HeaderContentProps) {
  return (
    <>
      {showArtistAboveCover && <ArtistAboveCoverFallback />}

      <div className="flex flex-col items-center md:flex-row md:items-center w-full gap-3 md:gap-6 lg:gap-8">
        <Skeleton className="rounded shadow-header-image w-[168px] h-[168px] min-w-[168px] min-h-[168px] sm:w-[200px] sm:h-[200px] sm:min-w-[200px] sm:min-h-[200px] 2xl:w-[250px] 2xl:h-[250px] 2xl:min-w-[250px] 2xl:min-h-[250px] aspect-square" />
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
        {showMobileSubtitle && (
          <Skeleton className="h-3 w-24 rounded mb-1 opacity-80" />
        )}
        <div className="flex flex-wrap justify-center gap-1">
          <Skeleton className="h-[22px] w-12 rounded-full" />
          <Skeleton className="h-[22px] w-12 rounded-full" />
        </div>
        {showSecondaryBadges && (
          <div className="flex flex-wrap justify-center gap-1 mt-1">
            <Skeleton className="h-[22px] w-12 rounded-full" />
            <Skeleton className="h-[22px] w-20 rounded-full" />
          </div>
        )}
      </div>
    </>
  );
}

export function AlbumHeaderFallback({
  showSecondaryBadges = false,
  showArtistAboveCover = false,
  showMobileSubtitle = true,
}: HeaderContentProps) {
  return (
    <div
      className={cn(
        IMAGE_HEADER_MAIN_GRADIENT,
        "w-full pb-3 pt-album-header px-album-header md:py-6 bg-background-foreground flex flex-col gap-2 md:gap-4",
      )}
    >
      <AlbumHeaderContent
        showSecondaryBadges={showSecondaryBadges}
        showArtistAboveCover={showArtistAboveCover}
        showMobileSubtitle={showMobileSubtitle}
      />
    </div>
  );
}

export function HeaderWithImageEffect({
  showSecondaryBadges = false,
  showArtistAboveCover = false,
  showMobileSubtitle = true,
}: HeaderContentProps) {
  return (
    <div className="flex flex-col relative w-full">
      <div className="relative w-full h-auto md:h-[calc(3rem+200px)] 2xl:h-[calc(3rem+250px)]">
        <div
          className={cn(
            IMAGE_HEADER_MAIN_GRADIENT,
            "w-full pb-3 pt-album-header px-album-header md:py-6 bg-background-foreground flex flex-col gap-2 md:gap-4 relative md:absolute md:inset-0",
          )}
        >
          <AlbumHeaderContent
            showSecondaryBadges={showSecondaryBadges}
            showArtistAboveCover={showArtistAboveCover}
            showMobileSubtitle={showMobileSubtitle}
          />
        </div>

        <ImageHeaderEffect className="bg-background-foreground" />
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

export function MobileSongListFallback({
  length = 8,
}: { length?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg px-3 py-2 min-h-14"
        >
          <Skeleton className="size-10 rounded shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="size-11 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function MobileAlbumTrackListFallback({
  length = 10,
}: { length?: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg px-3 py-2 min-h-14"
        >
          <Skeleton className="w-5 h-4 rounded shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="size-11 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function AlbumFallback() {
  return (
    <div className="w-full bg-background min-h-content">
      <MobilePageHeader variant="sub" title="" showSpacer={false} />
      <HeaderWithImageEffect showSecondaryBadges showArtistAboveCover />
      <ListWrapper>
        <PlayButtonsFallback />
        <AlbumInfoFallback />
        <div className="md:hidden">
          <MobileAlbumTrackListFallback />
        </div>
        <div className="hidden md:block">
          <TableFallback variant="modern" columnIds={songDetailColumnIds} />
        </div>
      </ListWrapper>
    </div>
  );
}

export function AlbumsFallback() {
  return (
    <>
      <div className="w-full flex flex-col md:hidden">
        <MobilePageHeader
          variant="sub"
          title=""
          transparentTheme="default"
        />
        <div className="px-4 py-4">
          <div className="flex flex-col mb-4">
            <Skeleton id="detail-page-title" className="h-8 w-32 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
      <div className="w-full h-full hidden md:block">
        <ShadowHeaderFallback
          actions={
            <div className="flex gap-2">
              <Skeleton className="w-8 h-8 rounded-md" />
              <Skeleton className="w-32 h-9 rounded-md" />
            </div>
          }
        />

        <ListWrapper className="pt-[--shadow-header-distance] px-0">
          <GridFallback />
        </ListWrapper>
      </div>
    </>
  );
}

function GridFallback() {
  return (
    <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8 gap-3 md:gap-4 px-4 md:px-8">
      {Array.from({ length: 24 }, (_, i) => (
        <CardSkeleton key={"card-fallback-" + i} />
      ))}
    </div>
  );
}
