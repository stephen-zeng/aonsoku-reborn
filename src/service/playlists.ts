import { httpClient } from "@/api/httpClient";
import { libraryDb, withStarredAt } from "@/store/library-db";
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

async function getPersistedPlaylistStarred(
  playlistId: string,
  starred?: string,
) {
  if (starred !== undefined) return starred;
  return (await libraryDb.playlists.get(playlistId))?.starred;
}

async function persistPlaylistSummary(
  playlist: Playlist & { starred?: string },
) {
  const starred = await getPersistedPlaylistStarred(
    playlist.id,
    playlist.starred,
  );
  await libraryDb.playlists.put(
    withStarredAt({
      ...playlist,
      starred,
    }),
  );
}

async function persistPlaylistDetail(
  playlist: PlaylistWithEntries & { starred?: string },
) {
  const starred = await getPersistedPlaylistStarred(
    playlist.id,
    playlist.starred,
  );

  await Promise.all([
    libraryDb.playlists.put(
      withStarredAt({
        id: playlist.id,
        name: playlist.name,
        comment: playlist.comment,
        songCount: playlist.songCount,
        duration: playlist.duration,
        public: playlist.public,
        owner: playlist.owner,
        created: playlist.created,
        changed: playlist.changed,
        coverArt: playlist.coverArt,
        starred,
      }),
    ),
    libraryDb.playlistDetails.put(
      withStarredAt({
        ...playlist,
        starred,
      }),
    ),
  ]);
}

async function getAll() {
  const response = await httpClient<PlaylistsResponse>("/getPlaylists", {
    method: "GET",
  });

  const playlists = response.data.playlists.playlist ?? [];

  try {
    await libraryDb.playlists.bulkPut(playlists.map(withStarredAt));
  } catch (err) {
    console.warn("[playlists] failed to persist playlist summaries:", err);
  }

  return playlists;
}

async function getOne(id: string): Promise<PlaylistWithEntries | null> {
  const response = await httpClient<PlaylistWithEntriesResponse>(
    "/getPlaylist",
    {
      method: "GET",
      query: {
        id,
      },
    },
  );

  const playlist = response.data.playlist;

  try {
    if (playlist) {
      await persistPlaylistDetail(playlist);
    } else {
      await Promise.all([
        libraryDb.playlists.delete(id),
        libraryDb.playlistDetails.delete(id),
      ]);
    }
  } catch (err) {
    console.warn(`[playlists] failed to persist playlist ${id}:`, err);
  }

  return playlist;
}

async function remove(id: string) {
  await httpClient<SubsonicResponse>("/deletePlaylist", {
    method: "DELETE",
    query: {
      id,
    },
  });

  try {
    await Promise.all([
      libraryDb.playlists.delete(id),
      libraryDb.playlistDetails.delete(id),
    ]);
  } catch (err) {
    console.warn(`[playlists] failed to delete playlist ${id} locally:`, err);
  }
}

async function create(name: string, songs?: string[]) {
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

  const playlist = response.data.playlist as Playlist;

  try {
    await persistPlaylistSummary(playlist);
  } catch (err) {
    console.warn(
      `[playlists] failed to persist created playlist ${playlist.id}:`,
      err,
    );
  }

  return playlist;
}

async function update({
  playlistId,
  name,
  comment,
  songIdToAdd,
  songIndexToRemove,
  isPublic,
}: UpdateParams) {
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

  try {
    return await getOne(playlistId);
  } catch (err) {
    console.warn(
      `[playlists] failed to refresh updated playlist ${playlistId}:`,
      err,
    );
    return null;
  }
}

export async function createWithDetails(data: CreateParams) {
  const playlist = await create(data.name);

  if (playlist) {
    return update({
      playlistId: playlist.id,
      comment: data.comment,
      isPublic: data.isPublic,
      songIdToAdd: data.songIdToAdd,
    });
  }

  return null;
}

export const playlists = {
  getAll,
  getOne,
  remove,
  create,
  createWithDetails,
  update,
};
