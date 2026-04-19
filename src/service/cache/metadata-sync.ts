import { get, set } from "idb-keyval";
import { offlineLibraryStore } from "@/store/idb";
import { useAppStore } from "@/store/app.store";
import { useCacheStore } from "@/store/cache.store";
import { subsonic } from "@/service/subsonic";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/utils/queryKeys";
import { SyncPhase } from "@/types/cache";
import type { ISong } from "@/types/responses/song";
import type { ISimilarArtist } from "@/types/responses/artist";
import type { Genre } from "@/types/responses/genre";
import type { Playlist } from "@/types/responses/playlist";

interface AlbumSummary {
  id: string;
  name: string;
  artist: string;
  artistId?: string;
  coverArt?: string;
  songCount: number;
  duration: number;
  year?: number;
  genre?: string;
  created: string;
}

const IDB_KEYS = {
  genres: "offline-genres",
  artists: "offline-artists",
  albums: "offline-albums",
  songs: "offline-songs",
  playlists: "offline-playlists",
  timestamp: "offline-sync-timestamp",
};

class MetadataSyncService {
  private abortController: AbortController | null = null;

  private updateSyncState(
    phase: SyncPhase,
    processedItems = 0,
    totalItems = 0,
  ) {
    const { updateSyncState } = useCacheStore.getState().actions;
    updateSyncState({
      phase,
      isSyncing: phase !== "done" && phase !== "error" && phase !== "cancelled",
      processedItems,
      totalItems,
      progress:
        totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0,
    });
  }

  async syncAll(options?: { includeCoverArt?: boolean }): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      this.updateSyncState("idle");

      // 1. Genres
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("genres");
      const genres = await subsonic.genres.get();
      await set(IDB_KEYS.genres, genres, offlineLibraryStore);

      // 2. Artists
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("artists");
      const artists = await subsonic.artists.getAll();
      await set(IDB_KEYS.artists, artists, offlineLibraryStore);

      // 3. Albums (paginated)
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("albums");
      const allAlbums: AlbumSummary[] = [];
      let albumOffset = 0;
      const albumPageSize = 500;
      let hasMoreAlbums = true;

      while (hasMoreAlbums) {
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        const result = await subsonic.albums.getAlbumList({
          type: "alphabeticalByName",
          size: albumPageSize,
          offset: albumOffset,
        });

        if (!result.list || result.list.length === 0) {
          hasMoreAlbums = false;
        } else {
          for (const album of result.list) {
            allAlbums.push({
              id: album.id,
              name: album.name,
              artist: album.artist,
              artistId: album.artistId,
              coverArt: album.coverArt,
              songCount: album.songCount,
              duration: album.duration,
              year: album.year,
              genre: album.genre,
              created: album.created,
            });
          }
          this.updateSyncState(
            "albums",
            allAlbums.length,
            result.albumsCount || allAlbums.length,
          );
          albumOffset += albumPageSize;
          if (result.list.length < albumPageSize) {
            hasMoreAlbums = false;
          }
        }
      }
      await set(IDB_KEYS.albums, allAlbums, offlineLibraryStore);

      // 4. Songs
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("songs");
      const knownSongCount = useAppStore.getState().data.songCount ?? 100_000;
      const songs = await subsonic.songs.getAllSongs(knownSongCount);
      await set(IDB_KEYS.songs, songs, offlineLibraryStore);
      this.updateSyncState("songs", songs.length, songs.length);

      // 5. Playlists
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("playlists");
      const playlists = await subsonic.playlists.getAll();
      await set(IDB_KEYS.playlists, playlists, offlineLibraryStore);

      // 6. Cover art (optional, handled by cache manager separately)
      if (options?.includeCoverArt) {
        this.updateSyncState("coverArt", 0, allAlbums.length);
        // Cover art caching is delegated to the cache manager
        // to avoid duplicating caching logic here
      }

      // Done
      const timestamp = Date.now();
      await set(IDB_KEYS.timestamp, timestamp, offlineLibraryStore);
      useCacheStore.getState().actions.setLastSyncedAt(timestamp);
      this.updateSyncState("done");

      queryClient.invalidateQueries({ queryKey: queryKeys.album.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.artist.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.song.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.playlist.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.genre });
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites.count });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        this.updateSyncState("cancelled");
      } else {
        console.error("Metadata sync failed:", err);
        this.updateSyncState("error");
      }
    } finally {
      this.abortController = null;
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ── Retrieval ──

  async getGenres(): Promise<Genre[]> {
    return (await get<Genre[]>(IDB_KEYS.genres, offlineLibraryStore)) ?? [];
  }

  async getArtists(): Promise<ISimilarArtist[]> {
    return (
      (await get<ISimilarArtist[]>(IDB_KEYS.artists, offlineLibraryStore)) ?? []
    );
  }

  async getAlbums(): Promise<AlbumSummary[]> {
    return (
      (await get<AlbumSummary[]>(IDB_KEYS.albums, offlineLibraryStore)) ?? []
    );
  }

  async getSongs(): Promise<ISong[]> {
    return (await get<ISong[]>(IDB_KEYS.songs, offlineLibraryStore)) ?? [];
  }

  async getPlaylists(): Promise<Playlist[]> {
    return (
      (await get<Playlist[]>(IDB_KEYS.playlists, offlineLibraryStore)) ?? []
    );
  }

  async getLastSyncTime(): Promise<number | null> {
    return (await get<number>(IDB_KEYS.timestamp, offlineLibraryStore)) ?? null;
  }

  async hasSyncedData(): Promise<boolean> {
    const timestamp = await this.getLastSyncTime();
    return timestamp !== null;
  }

  async clearSyncedData(): Promise<void> {
    for (const key of Object.values(IDB_KEYS)) {
      await set(key, undefined, offlineLibraryStore);
    }
    useCacheStore.getState().actions.setLastSyncedAt(null);
  }
}

export const metadataSyncService = new MetadataSyncService();
