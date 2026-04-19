import { subsonic } from "@/service/subsonic";
import { useAppStore } from "@/store/app.store";
import { useCacheStore } from "@/store/cache.store";
import { libraryDb, withPlayedAt, withStarredAt } from "@/store/library-db";
import { queryClient } from "@/lib/queryClient";
import { queryKeys } from "@/utils/queryKeys";
import type { SyncPhase, SyncTier } from "@/types/cache";

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

interface SyncOptions {
  includeCoverArt?: boolean;
  /**
   * Gate the T3 full-songs sync step (the expensive one on large
   * libraries). T1 + T2 always run regardless. Default: true.
   */
  includeFullSongs?: boolean;
}

/**
 * Progressive, tiered metadata sync.
 *
 *  - T1 (seconds)       : user-visible essentials — favorites,
 *    playlists, genres. Users can meaningfully interact with the
 *    library once T1 lands.
 *  - T2 (minutes)       : library skeleton — every artist and every
 *    album summary, without per-song detail. Enables full browsing.
 *  - T3 (tens of minutes): the long tail — every song detail. Expensive
 *    on 100k+ libraries, so gated behind the `includeFullSongs` flag.
 *
 * Each tier is idempotent, writes its completion checkpoint to
 * libraryDb.syncState (key "tier:tN"), and invalidates the React
 * Query keys it touched so the UI refreshes as soon as data lands.
 * AbortController cancellation is honored at tier boundaries and at
 * every pagination step inside a tier.
 */
class MetadataSyncService {
  private abortController: AbortController | null = null;

  private updateSyncState(
    phase: SyncPhase,
    tier: SyncTier | undefined,
    processedItems = 0,
    totalItems = 0,
  ) {
    const { updateSyncState } = useCacheStore.getState().actions;
    updateSyncState({
      phase,
      tier,
      isSyncing: phase !== "done" && phase !== "error" && phase !== "cancelled",
      processedItems,
      totalItems,
      progress:
        totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0,
    });
  }

  private checkAborted(signal: AbortSignal) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  }

  private async recordTierCheckpoint(tier: SyncTier) {
    await libraryDb.syncState.put({
      key: `tier:${tier}`,
      lastSyncedAt: Date.now(),
    });
  }

  async syncAll(options?: SyncOptions): Promise<void> {
    const includeFullSongs = options?.includeFullSongs ?? true;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      this.updateSyncState("idle", undefined);

      await this.runT1(signal);
      await this.runT2(signal);
      if (includeFullSongs) {
        await this.runT3(signal);
      }

      if (options?.includeCoverArt) {
        this.updateSyncState("coverArt", undefined);
        // Cover art caching is delegated to the cache manager to avoid
        // duplicating caching logic here.
      }

      await libraryDb.syncState.put({
        key: "full-sync",
        lastSyncedAt: Date.now(),
      });
      useCacheStore.getState().actions.setLastSyncedAt(Date.now());
      this.updateSyncState("done", undefined);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        this.updateSyncState("cancelled", undefined);
      } else {
        console.error("Metadata sync failed:", err);
        this.updateSyncState("error", undefined);
      }
    } finally {
      this.abortController = null;
    }
  }

  /**
   * T1 — quick essentials (favorites, playlists, genres). Runs in
   * seconds even on large libraries. Upserts starred songs into
   * libraryDb.songs so the favorites view is populated before T3
   * brings in the full songs table.
   */
  private async runT1(signal: AbortSignal): Promise<void> {
    this.checkAborted(signal);
    this.updateSyncState("genres", "t1");
    const genres = await subsonic.genres.get();
    this.checkAborted(signal);
    if (genres?.length) {
      await libraryDb.genres.clear();
      await libraryDb.genres.bulkPut(genres);
    }

    this.checkAborted(signal);
    this.updateSyncState("playlists", "t1");
    const playlists = await subsonic.playlists.getAll();
    this.checkAborted(signal);
    if (playlists?.length) {
      await libraryDb.playlists.clear();
      await libraryDb.playlists.bulkPut(playlists.map(withStarredAt));
    }

    this.checkAborted(signal);
    this.updateSyncState("favorites", "t1");
    const starred = await subsonic.songs.getFavoriteSongs();
    this.checkAborted(signal);
    const starredSongs = starred?.song ?? [];
    if (starredSongs.length) {
      // Upsert (no clear) — T3 will rebuild the full table later but
      // until then favorites should be visible from T1 onward.
      await libraryDb.songs.bulkPut(
        starredSongs.map((s) => withPlayedAt(withStarredAt(s))),
      );
    }

    await this.recordTierCheckpoint("t1");
    queryClient.invalidateQueries({ queryKey: queryKeys.playlist.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.genre });
    queryClient.invalidateQueries({ queryKey: queryKeys.favorites.count });
    queryClient.invalidateQueries({ queryKey: queryKeys.song.all });
  }

  /**
   * T2 — library skeleton. Pulls every artist and every album summary
   * so browsing by artist / album / genre works end-to-end, even
   * offline. Does not fetch per-song detail.
   */
  private async runT2(signal: AbortSignal): Promise<void> {
    this.checkAborted(signal);
    this.updateSyncState("artists", "t2");
    const artists = await subsonic.artists.getAll();
    this.checkAborted(signal);
    if (artists?.length) {
      await libraryDb.artists.clear();
      await libraryDb.artists.bulkPut(artists.map(withStarredAt));
    }

    this.checkAborted(signal);
    this.updateSyncState("albums", "t2");
    const allAlbums: AlbumSummary[] = [];
    let albumOffset = 0;
    const albumPageSize = 500;
    let hasMoreAlbums = true;

    while (hasMoreAlbums) {
      this.checkAborted(signal);

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
          "t2",
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

    await this.recordTierCheckpoint("t2");
    queryClient.invalidateQueries({ queryKey: queryKeys.artist.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.album.all });
  }

  /**
   * T3 — the long tail: every song detail. Uses
   * `search3?query=""&songCount=N` to page through the whole
   * library. Expected to take minutes to tens of minutes on large
   * libraries; gated behind `includeFullSongs` so users on big servers
   * who don't need offline-everywhere can opt out.
   */
  private async runT3(signal: AbortSignal): Promise<void> {
    this.checkAborted(signal);
    this.updateSyncState("songs", "t3");
    const knownSongCount = useAppStore.getState().data.songCount ?? 100_000;
    const songs = await subsonic.songs.getAllSongs(knownSongCount);
    this.checkAborted(signal);
    if (songs?.length) {
      await libraryDb.songs.clear();
      await libraryDb.songs.bulkPut(
        songs.map((s) => withPlayedAt(withStarredAt(s))),
      );
    }
    this.updateSyncState("songs", "t3", songs.length, songs.length);

    await this.recordTierCheckpoint("t3");
    queryClient.invalidateQueries({ queryKey: queryKeys.song.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.favorites.count });
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

export const metadataSyncService = new MetadataSyncService();
