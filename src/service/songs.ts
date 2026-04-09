import { httpClient } from "@/api/httpClient";
import {
  getOfflineFavoriteSongs,
  getOfflineRandomSongs,
  getOfflineSongById,
} from "@/lib/offline/library-read-model";
import { readOfflineCapable, readOnlineOnly } from "@/lib/offline/read-model";
import {
  FavoritesResponse,
  GetSongResponse,
  RandomSongsResponse,
  TopSongsResponse,
} from "@/types/responses/song";
import { search } from "./search";

interface GetRandomSongsParams {
  size?: number;
  genre?: string;
  fromYear?: number;
  toYear?: number;
}

async function getRandomSongs({
  size,
  genre,
  fromYear,
  toYear,
}: GetRandomSongsParams) {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<RandomSongsResponse>(
        "/getRandomSongs",
        {
          method: "GET",
          query: {
            size: size?.toString(),
            genre,
            fromYear: fromYear?.toString(),
            toYear: toYear?.toString(),
          },
        },
      );

      return response.data.randomSongs.song;
    },
    () => getOfflineRandomSongs(size),
  );
}

async function getFavoriteSongs() {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<FavoritesResponse>("/getStarred2", {
        method: "GET",
      });
      return response.data.starred2;
    },
    async () => ({
      song: await getOfflineFavoriteSongs(),
    }),
  );
}

async function getTopSongs(artistName: string) {
  return readOnlineOnly(async () => {
    const response = await httpClient<TopSongsResponse>("/getTopSongs", {
      method: "GET",
      query: {
        artist: artistName,
      },
    });

    return response.data.topSongs.song;
  }, null);
}

async function getAllSongs(songCount: number) {
  const response = await search.get({
    query: "",
    albumCount: 0,
    artistCount: 0,
    songCount,
    songOffset: 0,
  });

  return response?.song ?? [];
}

async function getSong(id: string) {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<GetSongResponse>("/getSong", {
        method: "GET",
        query: {
          id,
        },
      });

      return response.data.song;
    },
    () => getOfflineSongById(id),
  );
}

export const songs = {
  getAllSongs,
  getFavoriteSongs,
  getRandomSongs,
  getTopSongs,
  getSong,
};
