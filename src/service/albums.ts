import { httpClient } from "@/api/httpClient";
import { getOfflineAlbumList } from "@/lib/offline/library-read-model";
import { readOfflineCapable, readOnlineOnly } from "@/lib/offline/read-model";
import {
  AlbumInfoResponse,
  AlbumListResponse,
  AlbumListType,
  GetAlbumResponse,
  IAlbumInfo,
  SingleAlbum,
} from "@/types/responses/album";

export interface AlbumListParams {
  type: AlbumListType;
  size?: number;
  offset?: number;
  fromYear?: string;
  toYear?: string;
  genre?: string;
}

async function getAlbumList(params: Partial<AlbumListParams> = {}) {
  const {
    type = "newest",
    size = 30,
    offset = 0,
    fromYear,
    toYear,
    genre,
  } = params;

  return readOfflineCapable(
    async () => {
      const response = await httpClient<AlbumListResponse>("/getAlbumList2", {
        method: "GET",
        query: {
          type,
          size: size.toString(),
          offset: offset.toString(),
          fromYear,
          toYear,
          genre,
        },
      });

      return {
        albumsCount: response.count,
        list: response.data.albumList2.album,
      };
    },
    () =>
      getOfflineAlbumList({
        type,
        size,
        offset,
        fromYear,
        toYear,
        genre,
      }),
  );
}

async function getOne(id: string): Promise<SingleAlbum | undefined> {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<GetAlbumResponse>("/getAlbum", {
        method: "GET",
        query: {
          id,
        },
      });

      return response.data.album;
    },
    async () => {
      const { metadataCache } = await import("@/lib/cache/metadata-cache");
      return metadataCache.getAlbumWithSongs(id);
    },
  );
}

async function getInfo(id: string): Promise<IAlbumInfo | null> {
  return readOnlineOnly(async () => {
    const response = await httpClient<AlbumInfoResponse>("/getAlbumInfo2", {
      method: "GET",
      query: {
        id,
      },
    });

    return response.data.albumInfo;
  }, null);
}

export const albums = {
  getAlbumList,
  getOne,
  getInfo,
};
