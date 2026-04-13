import { HeaderWithImageEffect } from "@/app/components/fallbacks/album-fallbacks";
import { PreviewListFallback } from "@/app/components/fallbacks/home-fallbacks";
import { ArtistsTableFallback } from "@/app/components/fallbacks/song-fallbacks";
import { TopSongsTableFallback } from "@/app/components/fallbacks/table-fallbacks";
import { DetailButtonsFallback } from "@/app/components/fallbacks/ui-fallbacks";
import ListWrapper from "@/app/components/list-wrapper";
import { Skeleton } from "@/app/components/ui/skeleton";

function ArtistInfoFallback() {
  return (
    <div className="w-full">
      <DetailButtonsFallback />
      <div className="flex flex-col gap-2 mt-2">
        <Skeleton className="w-48 h-4 rounded" />
        <div className="flex flex-col gap-1">
          <Skeleton className="w-full h-3 rounded" />
          <Skeleton className="w-3/4 h-3 rounded" />
        </div>
      </div>
    </div>
  );
}

function ArtistFallback() {
  return (
    <div className="w-full bg-background min-h-content">
      <HeaderWithImageEffect />
      <ListWrapper>
        <ArtistInfoFallback />
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
