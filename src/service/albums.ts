import { httpClient } from "@/api/httpClient";
import { libraryDb, withPlayedAt, withStarredAt } from "@/store/library-db";
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
}

async function getOne(id: string): Promise<SingleAlbum | undefined> {
  const response = await httpClient<GetAlbumResponse>("/getAlbum", {
    method: "GET",
    query: {
      id,
    },
  });

  const album = response.data.album;

  try {
    if (album) {
      const { song, ...summary } = album;
      await Promise.all([
        libraryDb.albums.put(withStarredAt(summary)),
        song.length > 0
          ? libraryDb.songs.bulkPut(
              song.map((item) => withPlayedAt(withStarredAt(item))),
            )
          : Promise.resolve(),
      ]);
    }
  } catch (err) {
    console.warn(`[albums] failed to persist album ${id}:`, err);
  }

  return album;
}

async function getInfo(id: string): Promise<IAlbumInfo | null> {
  const response = await httpClient<AlbumInfoResponse>("/getAlbumInfo2", {
    method: "GET",
    query: {
      id,
    },
  });

  return response.data.albumInfo;
}

export const albums = {
  getAlbumList,
  getOne,
  getInfo,
};
