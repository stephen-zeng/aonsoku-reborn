import { subsonic } from "@/service/subsonic";
import { useAppStore } from "@/store/app.store";
import { useCacheStore } from "@/store/cache.store";
import { libraryDb, withPlayedAt, withStarredAt } from "@/store/library-db";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/utils/queryKeys";
import { SyncPhase } from "@/types/cache";

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
  starred?: string;
}

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
      if (genres?.length) {
        await libraryDb.genres.clear();
        await libraryDb.genres.bulkPut(genres);
      }

      // 2. Artists
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("artists");
      const artists = await subsonic.artists.getAll();
      if (artists?.length) {
        await libraryDb.artists.clear();
        await libraryDb.artists.bulkPut(artists.map(withStarredAt));
      }

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
              starred: album.starred,
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
      if (allAlbums.length) {
        await libraryDb.albums.clear();
        await libraryDb.albums.bulkPut(allAlbums.map(withStarredAt));
      }

      // 4. Songs
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("songs");
      const knownSongCount = useAppStore.getState().data.songCount ?? 100_000;
      const songs = await subsonic.songs.getAllSongs(knownSongCount);
      if (songs?.length) {
        await libraryDb.songs.clear();
        await libraryDb.songs.bulkPut(
          songs.map((s) => withPlayedAt(withStarredAt(s))),
        );
      }
      this.updateSyncState("songs", songs.length, songs.length);

      // 5. Playlists
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      this.updateSyncState("playlists");
      const playlists = await subsonic.playlists.getAll();
      if (playlists?.length) {
        await libraryDb.playlists.clear();
        await libraryDb.playlists.bulkPut(playlists.map(withStarredAt));
      }

      // 6. Cover art (optional, handled by cache manager separately)
      if (options?.includeCoverArt) {
        this.updateSyncState("coverArt", 0, allAlbums.length);
        // Cover art caching is delegated to the cache manager
        // to avoid duplicating caching logic here
      }

      // Done
      const timestamp = Date.now();
      await libraryDb.syncState.put({
        key: "full-sync",
        lastSyncedAt: timestamp,
      });
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
}

export const metadataSyncService = new MetadataSyncService();
