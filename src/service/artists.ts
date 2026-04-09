import { httpClient } from "@/api/httpClient";
import { getOfflineArtists } from "@/lib/offline/library-read-model";
import { readOfflineCapable, readOnlineOnly } from "@/lib/offline/read-model";
import {
  ArtistInfoResponse,
  ArtistResponse,
  ArtistsResponse,
  IArtist,
  IArtistInfo,
  ISimilarArtist,
} from "@/types/responses/artist";

async function getAll() {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<ArtistsResponse>("/getArtists", {
        method: "GET",
      });

      const artistsList: ISimilarArtist[] = [];

      response.data.artists.index.forEach((item) => {
        artistsList.push(...item.artist);
      });

      return artistsList.sort((a, b) => a.name.localeCompare(b.name));
    },
    () => getOfflineArtists(),
  );
}

async function getOne(id: string): Promise<IArtist | undefined> {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<ArtistResponse>("/getArtist", {
        method: "GET",
        query: {
          id,
        },
      });

      return response.data.artist;
    },
    async () => {
      const { metadataCache } = await import("@/lib/cache/metadata-cache");
      return metadataCache.getArtistWithAlbums(id);
    },
  );
}

async function getInfo(id: string): Promise<IArtistInfo | null> {
  return readOnlineOnly(async () => {
    const response = await httpClient<ArtistInfoResponse>("/getArtistInfo", {
      method: "GET",
      query: {
        id,
      },
    });

    return response.data.artistInfo;
  }, null);
}

export const artists = {
  getOne,
  getInfo,
  getAll,
};
