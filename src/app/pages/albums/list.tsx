import { AlbumGridCard } from "@/app/components/albums/album-grid-card";
import { EmptyAlbums } from "@/app/components/albums/empty-page";
import { EmptyWrapper } from "@/app/components/albums/empty-wrapper";
import { AlbumsHeader } from "@/app/components/albums/header";
import { AlbumsFallback } from "@/app/components/fallbacks/album-fallbacks";
import { GridViewWrapper } from "@/app/components/grid-view-wrapper";
import ListWrapper from "@/app/components/list-wrapper";
import { OfflineLibraryEmptyState } from "@/app/components/offline/library-empty-state";
import { useOfflineLibraryStatus } from "@/app/hooks/use-offline-library-status";
import { useAlbumsListModel } from "./list.model";

export default function AlbumsList() {
  const { isOfflineMode, hasOfflineData } = useOfflineLibraryStatus();
  const { isLoading, isEmpty, albums, albumsCount } = useAlbumsListModel();

  if (isLoading) return <AlbumsFallback />;
  if (isOfflineMode && !hasOfflineData) {
    return (
      <div className="w-full h-content">
        <AlbumsHeader albumCount={0} />

        <ListWrapper className="pt-[--shadow-header-distance] h-full">
          <EmptyWrapper>
            <OfflineLibraryEmptyState />
          </EmptyWrapper>
        </ListWrapper>
      </div>
    );
  }
  if (isEmpty) return <EmptyAlbums />;

  return (
    <div className="w-full h-full">
      <AlbumsHeader albumCount={albumsCount} />

      <ListWrapper className="pt-[--shadow-header-distance] px-0">
        <GridViewWrapper list={albums} data-testid="albums-grid" type="albums">
          {(album) => <AlbumGridCard album={album} />}
        </GridViewWrapper>
      </ListWrapper>
    </div>
  );
}
