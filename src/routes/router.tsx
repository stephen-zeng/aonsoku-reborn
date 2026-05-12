import { lazy, Suspense } from "react";
import { createHashRouter } from "react-router-dom";

import {
  AlbumFallback,
  AlbumsFallback,
} from "@/app/components/fallbacks/album-fallbacks";
import {
  ArtistFallback,
  ArtistsFallback,
} from "@/app/components/fallbacks/artists";
import { HomeFallback } from "@/app/components/fallbacks/home-fallbacks";
import { PlaylistFallback } from "@/app/components/fallbacks/playlist-fallbacks";
import {
  FavoritesFallback,
  InfinitySongListFallback,
  MobileLibraryFallback,
  PlaylistsListFallback,
  RadiosListFallback,
} from "@/app/components/fallbacks/song-fallbacks";
import { loginLoader } from "@/routes/loginLoader";
import { protectedLoader } from "@/routes/protectedLoader";
import { ROUTES } from "@/routes/routesList";

const BaseLayout = lazy(() => import("@/app/layout/base"));
const Album = lazy(() => import("@/app/pages/albums/album"));
const AlbumsList = lazy(() => import("@/app/pages/albums/list"));
const Artist = lazy(() => import("@/app/pages/artists/artist"));
const ArtistsList = lazy(() => import("@/app/pages/artists/list"));
const ErrorPage = lazy(() => import("@/app/pages/error-page"));
const Favorites = lazy(() => import("@/app/pages/favorites/songlist"));
const Login = lazy(() => import("@/app/pages/login"));
const PlaylistsPage = lazy(() => import("@/app/pages/playlists/list"));
const Playlist = lazy(() => import("@/app/pages/playlists/playlist"));
const Radios = lazy(() => import("@/app/pages/radios/radios-list"));
const SongList = lazy(() => import("@/app/pages/songs/songlist"));
const Home = lazy(() => import("@/app/pages/home"));
const MobileLibrary = lazy(() => import("@/app/pages/mobile/library"));
const MobileSearch = lazy(() => import("@/app/pages/mobile/search"));
const MobileSettings = lazy(() => import("@/app/pages/mobile/settings"));

export const router = createHashRouter([
  {
    path: ROUTES.LIBRARY.HOME,
    element: <BaseLayout />,
    loader: protectedLoader,
    shouldRevalidate: () => false,
    children: [
      {
        id: "home",
        path: ROUTES.LIBRARY.HOME,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<HomeFallback />}>
            <Home />
          </Suspense>
        ),
      },
      {
        id: "artists",
        path: ROUTES.LIBRARY.ARTISTS,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<ArtistsFallback />}>
            <ArtistsList />
          </Suspense>
        ),
      },
      {
        id: "songs",
        path: ROUTES.LIBRARY.SONGS,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<InfinitySongListFallback />}>
            <SongList />
          </Suspense>
        ),
      },
      {
        id: "albums",
        path: ROUTES.LIBRARY.ALBUMS,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<AlbumsFallback />}>
            <AlbumsList />
          </Suspense>
        ),
      },
      {
        id: "favorites",
        path: ROUTES.LIBRARY.FAVORITES,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<FavoritesFallback />}>
            <Favorites />
          </Suspense>
        ),
      },
      {
        id: "playlists",
        path: ROUTES.LIBRARY.PLAYLISTS,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<PlaylistsListFallback />}>
            <PlaylistsPage />
          </Suspense>
        ),
      },
      {
        id: "radios",
        path: ROUTES.LIBRARY.RADIOS,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<RadiosListFallback />}>
            <Radios />
          </Suspense>
        ),
      },
      {
        id: "artist",
        path: ROUTES.ARTIST.PATH,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<ArtistFallback />}>
            <Artist />
          </Suspense>
        ),
      },
      {
        id: "album",
        path: ROUTES.ALBUM.PATH,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<AlbumFallback />}>
            <Album />
          </Suspense>
        ),
      },
      {
        id: "playlist",
        path: ROUTES.PLAYLIST.PATH,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<PlaylistFallback />}>
            <Playlist />
          </Suspense>
        ),
      },
      {
        id: "mobile-library",
        path: ROUTES.MOBILE.LIBRARY,
        errorElement: <ErrorPage />,
        element: (
          <Suspense fallback={<MobileLibraryFallback />}>
            <MobileLibrary />
          </Suspense>
        ),
      },
      {
        id: "mobile-search",
        path: ROUTES.MOBILE.SEARCH,
        errorElement: <ErrorPage />,
        element: (
          <Suspense>
            <MobileSearch />
          </Suspense>
        ),
      },
      {
        id: "mobile-settings",
        path: ROUTES.MOBILE.SETTINGS,
        errorElement: <ErrorPage />,
        element: (
          <Suspense>
            <MobileSettings />
          </Suspense>
        ),
      },
      {
        id: "error",
        path: "*",
        element: (
          <Suspense>
            <ErrorPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    id: "login",
    path: ROUTES.SERVER_CONFIG,
    loader: loginLoader,
    element: (
      <Suspense>
        <Login />
      </Suspense>
    ),
  },
]);
