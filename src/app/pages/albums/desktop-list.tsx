import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlbumGridCard } from "@/app/components/albums/album-grid-card";
import { EmptyAlbums } from "@/app/components/albums/empty-page";
import { AlbumsHeader } from "@/app/components/albums/header";
import { AlbumsFallback } from "@/app/components/fallbacks/album-fallbacks";
import { GridViewWrapper } from "@/app/components/grid-view-wrapper";
import ListWrapper from "@/app/components/list-wrapper";
import { ROUTES } from "@/routes/routesList";
import {
  AlbumsFilters,
  AlbumsSearchParams,
  PersistedAlbumListKeys,
} from "@/utils/albumsFilter";
import { useAlbumsListModel } from "./list.model";

export default function DesktopAlbumsList() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoading, isEmpty, albums, albumsCount } = useAlbumsListModel();

  useEffect(() => {
    const hasMainFilter = searchParams.has(AlbumsSearchParams.MainFilter);
    const hasArtistNameFilter = searchParams.has(AlbumsSearchParams.ArtistName);
    const hasArtistIdFilter = searchParams.has(AlbumsSearchParams.ArtistId);
    const hasGenreFilter = searchParams.has(AlbumsSearchParams.Genre);
    const hasYearFilter = searchParams.has(AlbumsSearchParams.YearFilter);

    const savedArtistName = localStorage.getItem(
      PersistedAlbumListKeys.ArtistNameFilter,
    );
    const savedArtistId = localStorage.getItem(
      PersistedAlbumListKeys.ArtistIdFilter,
    );
    const savedFilter = localStorage.getItem(PersistedAlbumListKeys.MainFilter);
    const isDiscography = savedFilter === AlbumsFilters.ByDiscography;
    const hasPersistedValues = savedArtistName && savedArtistId;
    const hasArtistFilter = hasArtistNameFilter && hasArtistIdFilter;

    if (
      hasPersistedValues &&
      !hasArtistFilter &&
      !hasMainFilter &&
      isDiscography
    ) {
      navigate(ROUTES.ALBUMS.ARTIST(savedArtistId, savedArtistName), {
        replace: true,
      });
      return;
    }

    if (hasArtistFilter) {
      const artistName = searchParams.get(AlbumsSearchParams.ArtistName) || "";
      const artistId = searchParams.get(AlbumsSearchParams.ArtistId) || "";
      localStorage.setItem(
        PersistedAlbumListKeys.MainFilter,
        AlbumsFilters.ByDiscography,
      );
      localStorage.setItem(PersistedAlbumListKeys.ArtistNameFilter, artistName);
      localStorage.setItem(PersistedAlbumListKeys.ArtistIdFilter, artistId);
    }

    const persistedYear = localStorage.getItem(
      PersistedAlbumListKeys.YearFilter,
    );
    const persistedMainFilter = localStorage.getItem(
      PersistedAlbumListKeys.MainFilter,
    );
    const isByYearFilter = persistedMainFilter === AlbumsFilters.ByYear;

    if (persistedYear && !hasYearFilter && isByYearFilter) {
      navigate(ROUTES.ALBUMS.YEAR(persistedYear), { replace: true });
      return;
    }

    if (hasYearFilter) {
      const yearFilter = searchParams.get(AlbumsSearchParams.YearFilter) || "";
      localStorage.setItem(PersistedAlbumListKeys.YearFilter, yearFilter);
    }

    const savedGenre = localStorage.getItem(PersistedAlbumListKeys.GenreFilter);
    const isByGenreFilter = persistedMainFilter === AlbumsFilters.ByGenre;

    if (savedGenre && !hasMainFilter && !hasGenreFilter && isByGenreFilter) {
      navigate(ROUTES.ALBUMS.GENRE(savedGenre), { replace: true });
      return;
    }

    if (hasGenreFilter) {
      const genre = searchParams.get(AlbumsSearchParams.Genre) || "";
      localStorage.setItem(PersistedAlbumListKeys.GenreFilter, genre);
    }

    if (savedFilter && !hasMainFilter) {
      navigate(ROUTES.ALBUMS.GENERIC(savedFilter), { replace: true });
    }
  }, [searchParams, navigate]);

  if (isLoading) return <AlbumsFallback />;
  if (isEmpty) return <EmptyAlbums />;

  return (
    <div className="w-full min-h-content">
      <AlbumsHeader albumCount={albumsCount} />

      <ListWrapper className="pt-[--shadow-header-distance] px-0">
        <GridViewWrapper list={albums} data-testid="albums-grid" type="albums">
          {(album) => <AlbumGridCard album={album} />}
        </GridViewWrapper>
      </ListWrapper>
    </div>
  );
}
