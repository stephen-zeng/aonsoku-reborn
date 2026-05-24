import {
  HeaderWithImageEffect,
  MobileSongListFallback,
} from "@/app/components/fallbacks/album-fallbacks";
import { TableFallback } from "@/app/components/fallbacks/table-fallbacks";
import { ButtonsBarFallback } from "@/app/components/fallbacks/ui-fallbacks";
import { MobilePageHeader } from "@/app/components/header/mobile-page-header";
import ListWrapper from "@/app/components/list-wrapper";
import { Skeleton } from "@/app/components/ui/skeleton";
import { songCollectionColumnIds } from "@/app/tables/column-layouts";

function PlaylistButtonsFallback() {
  return (
    <ButtonsBarFallback>
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14" />
      <Skeleton className="rounded-full w-14 h-14 md:order-first" />
      <Skeleton className="rounded-full w-12 h-12 md:w-14 md:h-14" />
    </ButtonsBarFallback>
  );
}

export function PlaylistFallback() {
  return (
    <div className="w-full bg-background min-h-content">
      <MobilePageHeader variant="sub" title="" showSpacer={false} />
      <HeaderWithImageEffect />

      <ListWrapper>
        <PlaylistButtonsFallback />
        <div className="md:hidden">
          <MobileSongListFallback />
        </div>
        <div className="hidden md:block">
          <TableFallback variant="modern" columnIds={songCollectionColumnIds} />
        </div>
      </ListWrapper>
    </div>
  );
}
