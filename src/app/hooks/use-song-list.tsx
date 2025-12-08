import { getArtistAllSongs as getArtistAllSongsQuery } from "@/queries/songs";
import { subsonic } from "@/service/subsonic";

export function useSongList() {
  async function getArtistSongCount(id: string) {
    const response = await subsonic.artists.getOne(id);
    let count = 0;

    if (!response || !response.album) return count;

    response.album.forEach((item) => {
      count += item.songCount;
    });

    return count;
  }

  async function getArtistAllSongs(id: string) {
    const response = await getArtistAllSongsQuery(id); // Renamed import or usage below

    if (!response || !response.songs) return undefined;

    return response.songs;
  }

  async function getAlbumSongs(albumId: string) {
    const songs = await subsonic.albums.getOne(albumId);

    if (!songs || !songs.song) return undefined;

    return songs.song;
  }

  return {
    getArtistSongCount,
    getArtistAllSongs,
    getAlbumSongs,
  };
}
