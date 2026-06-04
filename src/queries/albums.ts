import { AlbumListParams } from "@/service/albums";
import { subsonic } from "@/service/subsonic";
import { isNativeDataAvailable, AonsokuNativeData } from "@/native/data/facade";

const emptyResponse = { albums: [], nextOffset: null, albumsCount: 0 };

export async function getArtistDiscography(artistId: string) {
  if (isNativeDataAvailable()) {
    const result = await AonsokuNativeData.getAlbums({
      limit: 500,
      offset: 0,
      artistId,
      sortBy: "year",
      sortOrder: "desc",
    });
    return {
      albums: result.items,
      nextOffset: null,
      albumsCount: result.total,
    };
  }

  const response = await subsonic.artists.getOne(artistId);

  if (!response || !response.album) return emptyResponse;

  return {
    albums: response.album,
    nextOffset: null,
    albumsCount: response.album.length,
  };
}

interface AlbumSearch {
  query: string;
  count: number;
  offset: number;
}

export async function albumSearch({ query, count, offset }: AlbumSearch) {
  if (isNativeDataAvailable()) {
    const result = await AonsokuNativeData.getAlbums({
      limit: count,
      offset,
      search: query,
    });
    return {
      albums: result.items,
      nextOffset: result.hasMore ? offset + count : null,
      albumsCount: result.total,
    };
  }

  const response = await subsonic.search.get({
    query,
    songCount: 0,
    artistCount: 0,
    albumCount: count,
    albumOffset: offset,
  });

  if (!response?.album) return emptyResponse;

  let nextOffset: number | null = null;
  if (response.album.length >= count) {
    nextOffset = offset + count;
  }

  return {
    albums: response.album,
    nextOffset,
    albumsCount: offset + response.album.length,
  };
}

export async function getAlbumList(params: Required<AlbumListParams>) {
  if (isNativeDataAvailable()) {
    const sortMap: Record<string, string> = {
      alphabeticalByName: "name",
      alphabeticalByArtist: "artist",
      newest: "created",
      recent: "created",
      frequent: "playCount",
      starred: "starredAt",
      byYear: "year",
      random: "random",
    };

    let fromYear: number | undefined ;
    let toYear: number | undefined ;
    let sortOrder: "asc" | "desc" = "asc";

    if (params.type === "newest" || params.type === "recent") {
      sortOrder = "desc";
    }

    if (params.type === "byYear") {
      const fy = params.fromYear ? parseInt(params.fromYear, 10) : undefined;
      const ty = params.toYear ? parseInt(params.toYear, 10) : undefined;
      if (fy !== undefined && ty !== undefined && !isNaN(fy) && !isNaN(ty)) {
        if (fy > ty) {
          fromYear = ty;
          toYear = fy;
          sortOrder = "desc";
        } else {
          fromYear = fy;
          toYear = ty;
          sortOrder = "asc";
        }
      }
    }

    const result = await AonsokuNativeData.getAlbums({
      limit: params.size,
      offset: params.offset,
      sortBy: sortMap[params.type] || "name",
      sortOrder,
      genre: params.genre || undefined,
      fromYear,
      toYear,
    });
    return {
      albums: result.items,
      nextOffset: result.hasMore ? params.offset + params.size : null,
      albumsCount: result.total,
    };
  }

  const response = await subsonic.albums.getAlbumList(params);

  if (!response) return emptyResponse;
  if (!response.list) return emptyResponse;

  let nextOffset: number | null = null;
  if (response.list.length >= params.size) {
    nextOffset = params.offset + params.size;
  }

  return {
    albums: response.list,
    nextOffset,
    albumsCount: response.albumsCount || 0,
  };
}
