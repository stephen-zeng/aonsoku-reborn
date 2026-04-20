import { useQuery } from "@tanstack/react-query";
import { subsonic } from "@/service/subsonic";
import { useIsOnline } from "@/store/cache.store";
import { convertMinutesToMs } from "@/utils/convertSecondsToTime";
import { queryKeys } from "@/utils/queryKeys";
import { offlineData } from "@/lib/offlineQueryClient";
import {
  type AlbumListType,
  type Albums,
  type AlbumsListData,
} from "@/types/responses/album";

const HOME_SECTION_SIZE = 16;
type HomeAlbumListType = Extract<
  AlbumListType,
  "frequent" | "newest" | "random" | "recent"
>;

interface AlbumPlayStats {
  playedAt: number;
  playCount: number;
}

function toTimestamp(value?: string) {
  if (!value) return 0;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildAlbumsListData(list: Albums[]): AlbumsListData {
  return {
    list,
    albumsCount: list.length,
  };
}

function shuffleAlbums(list: Albums[]) {
  const shuffled = [...list];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function getAlbumStatsById(
  songs: Awaited<ReturnType<(typeof offlineData)["songs"]>>,
) {
  const statsByAlbumId = new Map<string, AlbumPlayStats>();

  for (const song of songs) {
    if (!song.albumId) continue;

    const stats = statsByAlbumId.get(song.albumId) ?? {
      playedAt: 0,
      playCount: 0,
    };

    stats.playCount += song.playCount ?? 0;
    stats.playedAt = Math.max(stats.playedAt, toTimestamp(song.played));
    statsByAlbumId.set(song.albumId, stats);
  }

  return statsByAlbumId;
}

function getAlbumPlayCount(
  album: Albums,
  statsByAlbumId: Map<string, AlbumPlayStats>,
) {
  return statsByAlbumId.get(album.id)?.playCount ?? album.playCount ?? 0;
}

function getAlbumPlayedAt(
  album: Albums,
  statsByAlbumId: Map<string, AlbumPlayStats>,
) {
  return statsByAlbumId.get(album.id)?.playedAt ?? toTimestamp(album.played);
}

async function getOfflineHomeAlbums(type: HomeAlbumListType) {
  const shouldReadSongStats = type === "frequent" || type === "recent";
  const [albums, songs] = await Promise.all([
    offlineData.albums(),
    shouldReadSongStats ? offlineData.songs() : Promise.resolve([]),
  ]);
  const sortedAlbums = [...albums];
  const statsByAlbumId = getAlbumStatsById(songs);

  if (type === "newest") {
    sortedAlbums.sort((albumA, albumB) => {
      return toTimestamp(albumB.created) - toTimestamp(albumA.created);
    });
  }

  if (type === "frequent") {
    sortedAlbums.sort((albumA, albumB) => {
      return (
        getAlbumPlayCount(albumB, statsByAlbumId) -
        getAlbumPlayCount(albumA, statsByAlbumId)
      );
    });
  }

  if (type === "recent") {
    sortedAlbums.sort((albumA, albumB) => {
      return (
        getAlbumPlayedAt(albumB, statsByAlbumId) -
        getAlbumPlayedAt(albumA, statsByAlbumId)
      );
    });
  }

  const visibleAlbums = sortedAlbums.filter((album) => {
    if (type === "frequent") {
      return getAlbumPlayCount(album, statsByAlbumId) > 0;
    }

    if (type === "recent") {
      return getAlbumPlayedAt(album, statsByAlbumId) > 0;
    }

    return true;
  });

  const list =
    type === "random"
      ? shuffleAlbums(visibleAlbums).slice(0, HOME_SECTION_SIZE)
      : visibleAlbums.slice(0, HOME_SECTION_SIZE);

  return buildAlbumsListData(list);
}

function useHomeAlbumQuery(
  queryKey: readonly unknown[],
  type: HomeAlbumListType,
  options?: { refetchInterval?: number | false },
) {
  const isOnline = useIsOnline();

  return useQuery<AlbumsListData>({
    queryKey: [...queryKey, isOnline ? "online" : "offline"],
    queryFn: async () => {
      if (isOnline) {
        try {
          return await subsonic.albums.getAlbumList({
            size: HOME_SECTION_SIZE,
            type,
          });
        } catch (err) {
          console.warn(
            `[home] Failed to load ${type} albums, falling back to IDB:`,
            err,
          );
        }
      }

      return getOfflineHomeAlbums(type);
    },
    networkMode: "always",
    refetchOnReconnect: true,
    ...options,
  });
}

export const useGetRandomSongs = () => {
  const isOnline = useIsOnline();

  return useQuery({
    queryKey: [...queryKeys.song.random],
    queryFn: () => subsonic.songs.getRandomSongs({ size: 10 }),
    enabled: isOnline,
  });
};

export const useGetRecentlyAdded = () =>
  useHomeAlbumQuery(
    [...queryKeys.album.recentlyAdded],
    "newest",
  );

export const useGetMostPlayed = () =>
  useHomeAlbumQuery(
    [...queryKeys.album.mostPlayed],
    "frequent",
  );

export const useGetRecentlyPlayed = () => {
  const isOnline = useIsOnline();

  return useHomeAlbumQuery(
    [...queryKeys.album.recentlyPlayed],
    "recent",
    {
      refetchInterval: isOnline ? convertMinutesToMs(2) : false,
    },
  );
};

export const useGetRandomAlbums = () =>
  useHomeAlbumQuery(
    [...queryKeys.album.random],
    "random",
  );
