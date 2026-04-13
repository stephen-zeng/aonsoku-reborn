import { HeaderWithImageEffect } from "@/app/components/fallbacks/album-fallbacks";
import { PreviewListFallback } from "@/app/components/fallbacks/home-fallbacks";
import { ArtistsTableFallback } from "@/app/components/fallbacks/song-fallbacks";
import { TopSongsTableFallback } from "@/app/components/fallbacks/table-fallbacks";
import { ButtonsBarFallback } from "@/app/components/fallbacks/ui-fallbacks";
import ListWrapper from "@/app/components/list-wrapper";
import { Skeleton } from "@/app/components/ui/skeleton";

function ArtistButtonsFallback() {
  return (
    <ButtonsBarFallback>
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14" />
      <Skeleton className="rounded-full w-14 h-14 md:order-first" />
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14 hidden md:inline-flex" />
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14 hidden md:inline-flex" />
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14" />
    </ButtonsBarFallback>
  );
}

function ArtistFallback() {
  return (
    <div className="w-full">
      <HeaderWithImageEffect />
      <ListWrapper>
        <ArtistButtonsFallback />
        <TopSongsTableFallback />
        <PreviewListFallback />
        <PreviewListFallback />
      </ListWrapper>
    </div>
  );
}

export function ArtistsFallback() {
  return <ArtistsTableFallback />;
}

export { ArtistFallback };
