import { httpClient } from "@/api/httpClient";
import { getOfflinePlaylists } from "@/lib/offline/library-read-model";
import {
  assertOnlineAccess,
  readOfflineCapable,
  readOnlineOnly,
} from "@/lib/offline/read-model";
import {
  CreateParams,
  Playlist,
  PlaylistsResponse,
  PlaylistWithEntries,
  PlaylistWithEntriesResponse,
  SinglePlaylistResponse,
  UpdateParams,
} from "@/types/responses/playlist";
import { SubsonicResponse } from "@/types/responses/subsonicResponse";

async function getAll() {
  return readOfflineCapable(
    async () => {
      const response = await httpClient<PlaylistsResponse>("/getPlaylists", {
        method: "GET",
      });

      return response.data.playlists.playlist ?? [];
    },
    () => getOfflinePlaylists(),
  );
}

async function getOne(id: string): Promise<PlaylistWithEntries | null> {
  return readOnlineOnly(async () => {
    const response = await httpClient<PlaylistWithEntriesResponse>(
      "/getPlaylist",
      {
        method: "GET",
        query: {
          id,
        },
      },
    );

    return response.data.playlist;
  }, null);
}

async function remove(id: string) {
  assertOnlineAccess();
  await httpClient<SubsonicResponse>("/deletePlaylist", {
    method: "DELETE",
    query: {
      id,
    },
  });
}

async function create(name: string, songs?: string[]) {
  assertOnlineAccess();
  const query = new URLSearchParams();
  query.append("name", name);

  if (songs) {
    songs.forEach((song) => query.append("songId", song));
  }

  const response = await httpClient<SinglePlaylistResponse>(
    `/createPlaylist?${query.toString()}`,
    {
      method: "GET",
    },
  );

  return response.data.playlist as Playlist;
}

async function update({
  playlistId,
  name,
  comment,
  songIdToAdd,
  songIndexToRemove,
  isPublic,
}: UpdateParams) {
  assertOnlineAccess();
  const query = new URLSearchParams({
    playlistId,
  });
  if (name) query.append("name", name);
  if (comment) query.append("comment", comment);
  if (isPublic) query.append("public", isPublic);

  if (songIdToAdd) {
    if (typeof songIdToAdd === "string") {
      query.append("songIdToAdd", songIdToAdd);
    } else {
      songIdToAdd.forEach((songId) => query.append("songIdToAdd", songId));
    }
  }

  if (songIndexToRemove) {
    if (typeof songIndexToRemove === "string") {
      query.append("songIndexToRemove", songIndexToRemove);
    } else {
      songIndexToRemove.forEach((songIndex) =>
        query.append("songIndexToRemove", songIndex),
      );
    }
  }

  await httpClient<SubsonicResponse>(`/updatePlaylist?${query.toString()}`, {
    method: "GET",
  });
}

export async function createWithDetails(data: CreateParams) {
  assertOnlineAccess();
  const playlist = await create(data.name);

  if (playlist) {
    await update({
      playlistId: playlist.id,
      comment: data.comment,
      isPublic: data.isPublic,
      songIdToAdd: data.songIdToAdd,
    });
  }
}

export const playlists = {
  getAll,
  getOne,
  remove,
  create,
  createWithDetails,
  update,
};
