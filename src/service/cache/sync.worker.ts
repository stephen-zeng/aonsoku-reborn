import { expose } from "comlink";
import type { SyncPhase, SyncTier } from "@/types/cache";
import { type ServerAuthConfig, buildCoverArtUrl } from "@/api/urlBuilder";
import {
  workerHttpClient,
  initAuth as workerInitAuth,
  updateAuth as workerUpdateAuth,
  ensureAuth as workerEnsureAuth,
} from "@/api/workerHttpClient";
import { LibraryDB, withStarredAt, withPlayedAt } from "@/store/library-db";
import type { PlaylistRow, CacheMetaRow } from "@/store/library-db";
import type { GenresResponse } from "@/types/responses/genre";
import type {
  PlaylistsResponse,
  PlaylistWithEntries,
  PlaylistWithEntriesResponse,
} from "@/types/responses/playlist";
import type { ArtistsResponse, ISimilarArtist } from "@/types/responses/artist";
import type { AlbumListResponse } from "@/types/responses/album";
import type { FavoritesResponse } from "@/types/responses/song";
import type { ISearchResponse } from "@/types/responses/search";
import { coverKey } from "@/service/cache/cache-keys";

interface WorkerAuthConfig extends ServerAuthConfig {
  serverType?: string | null;
}

interface SyncOptions {
  includeCoverArt?: boolean;
  includeFullSongs?: boolean;
  mode?: "full" | "incremental";
  songCount?: number;
  useAlbumCoverForSongs?: boolean;
}

const TIER_FRESH_WINDOW_MS: Record<SyncTier, number> = {
  t1: 5 * 60 * 1000,
  t2: 30 * 60 * 1000,
  t3: 2 * 60 * 60 * 1000,
};

const BULK_CHUNK_SIZE = 2000;
const PLAYLIST_DETAIL_BATCH_SIZE = 25;

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
  played?: string;
  playCount?: number;
  starred?: string;
}

let db: LibraryDB;

const CACHE_NAME = "aonsoku-media-cache";

async function getWorkerCache(): Promise<Cache> {
  return caches.open(CACHE_NAME);
}

function wCacheKey(key: string): string {
  return `/_cache/${encodeURIComponent(key)}`;
}

function wCacheKeyLegacy(key: string): string {
  return `/_cache/${key}`;
}

async function cacheStoragePut(
  key: string,
  data: Blob,
  contentType: string,
): Promise<void> {
  const cache = await getWorkerCache();
  const response = new Response(data, {
    headers: {
      "Content-Type": contentType,
      "X-Cached-At": Date.now().toString(),
    },
  });
  await cache.put(wCacheKey(key), response);
}

async function cacheStorageGet(key: string): Promise<Blob | null> {
  const cache = await getWorkerCache();
  let response = await cache.match(wCacheKey(key));
  if (!response) {
    response = await cache.match(wCacheKeyLegacy(key));
  }
  if (!response) return null;
  return response.blob();
}

async function bulkPutInChunks<T, K>(
  table: { bulkPut: (rows: T[]) => Promise<K> },
  rows: T[],
  signal: AbortSignal,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += BULK_CHUNK_SIZE) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    await table.bulkPut(rows.slice(offset, offset + BULK_CHUNK_SIZE));
  }
}

class SyncWorkerService {
  private abortController: AbortController | null = null;
  private syncGeneration = 0;
  private authReady: Promise<void>;
  private resolveAuthReady: () => void;

  private syncStateTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSyncState: Partial<SyncState> | null = null;

  onSyncStateUpdate: ((state: Partial<SyncState>) => void) | undefined;
  onInvalidateQueries: ((keys: string[][]) => void) | undefined;
  onLastSyncedAt: ((timestamp: number) => void) | undefined;
  onCacheIndexRefresh: (() => void) | undefined;

  constructor() {
    this.authReady = new Promise((resolve) => {
      this.resolveAuthReady = resolve;
    });
  }

  initAuth(config: WorkerAuthConfig): void {
    workerInitAuth(config);
    this.resolveAuthReady();
  }

  updateAuth(config: WorkerAuthConfig): void {
    workerUpdateAuth(config);
  }

  private flushSyncState(): void {
    if (this.pendingSyncState) {
      const state = this.pendingSyncState;
      this.pendingSyncState = null;
      this.onSyncStateUpdate?.(state);
    }
  }

  private updateSyncState(
    phase: SyncPhase,
    tier: SyncTier | undefined,
    processedItems = 0,
    totalItems = 0,
  ): void {
    this.pendingSyncState = {
      phase,
      tier,
      isSyncing: phase !== "done" && phase !== "error" && phase !== "cancelled",
      processedItems,
      totalItems,
      progress:
        totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0,
    };
    if (!this.syncStateTimer) {
      this.syncStateTimer = setTimeout(() => {
        this.syncStateTimer = null;
        this.flushSyncState();
      }, 200);
    }
  }

  private forceFlushSyncState(): void {
    if (this.syncStateTimer) {
      clearTimeout(this.syncStateTimer);
      this.syncStateTimer = null;
    }
    this.flushSyncState();
  }

  private checkAborted(signal: AbortSignal): void {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  }

  private async recordTierCheckpoint(tier: SyncTier): Promise<void> {
    await db.syncState.put({
      key: `tier:${tier}`,
      lastSyncedAt: Date.now(),
    });
  }

  private async shouldSkipTier(
    tier: SyncTier,
    mode: "full" | "incremental",
  ): Promise<boolean> {
    if (mode === "full") return false;
    const entry = await db.syncState.get(`tier:${tier}`);
    if (!entry?.lastSyncedAt) return false;
    return Date.now() - entry.lastSyncedAt < TIER_FRESH_WINDOW_MS[tier];
  }

  private async syncPlaylistDetails(
    playlists: PlaylistRow[],
    signal: AbortSignal,
  ): Promise<void> {
    const playlistIds = new Set(playlists.map((p) => p.id));
    const existingIds = await db.playlistDetails.toCollection().primaryKeys();
    const removedIds = existingIds.filter((id) => !playlistIds.has(id));

    if (removedIds.length > 0) {
      await db.playlistDetails.bulkDelete(removedIds);
    }

    for (
      let offset = 0;
      offset < playlists.length;
      offset += PLAYLIST_DETAIL_BATCH_SIZE
    ) {
      this.checkAborted(signal);

      const batch = playlists.slice(
        offset,
        offset + PLAYLIST_DETAIL_BATCH_SIZE,
      );
      const results = await Promise.allSettled(
        batch.map((playlist) =>
          workerHttpClient<PlaylistWithEntriesResponse>("/getPlaylist", {
            query: { id: playlist.id },
          }),
        ),
      );

      const detailsToPersist: PlaylistWithEntries[] = [];
      const failedIds: string[] = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.data.playlist) {
          detailsToPersist.push(result.value.data.playlist);
        } else if (result.status === "rejected") {
          console.warn(
            `[metadataSync] failed to load playlist detail ${batch[index].id}:`,
            result.reason,
          );
          failedIds.push(batch[index].id);
        }
      });

      if (failedIds.length > 0) {
        const retryResults = await Promise.allSettled(
          failedIds.map((id) =>
            workerHttpClient<PlaylistWithEntriesResponse>("/getPlaylist", {
              query: { id },
            }),
          ),
        );
        retryResults.forEach((result) => {
          if (result.status === "fulfilled" && result.value.data.playlist) {
            detailsToPersist.push(result.value.data.playlist);
          }
        });
      }

      if (detailsToPersist.length > 0) {
        await db.playlistDetails.bulkPut(detailsToPersist.map(withStarredAt));
      }

      this.updateSyncState(
        "playlists",
        "t1",
        Math.min(offset + batch.length, playlists.length),
        playlists.length,
      );
    }
  }

  async syncAll(options?: SyncOptions): Promise<void> {
    await this.authReady;
    const includeFullSongs = options?.includeFullSongs ?? true;
    const mode = options?.mode ?? "full";
    const generation = ++this.syncGeneration;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      this.updateSyncState("idle", undefined);

      if (!(await this.shouldSkipTier("t1", mode))) {
        await this.runT1(signal);
      }
      if (this.syncGeneration !== generation) return;
      if (!(await this.shouldSkipTier("t2", mode))) {
        await this.runT2(signal);
      }
      if (this.syncGeneration !== generation) return;
      if (includeFullSongs && !(await this.shouldSkipTier("t3", mode))) {
        await this.runT3(signal, options?.songCount ?? 100_000);
      }
      if (this.syncGeneration !== generation) return;

      if (options?.includeCoverArt) {
        this.updateSyncState("coverArt", undefined);
        await this.syncCoverArt(
          options.useAlbumCoverForSongs ?? false,
          (processed, total) => {
            this.updateSyncState("coverArt", undefined, processed, total);
          },
        );
      }

      await db.syncState.put({
        key: "full-sync",
        lastSyncedAt: Date.now(),
      });
      this.onLastSyncedAt?.(Date.now());
      this.updateSyncState("done", undefined);
      this.forceFlushSyncState();
      this.onCacheIndexRefresh?.();
    } catch (err) {
      if (this.syncGeneration !== generation) return;
      if (err instanceof DOMException && err.name === "AbortError") {
        this.updateSyncState("cancelled", undefined);
      } else {
        console.error("Metadata sync failed:", err);
        this.updateSyncState("error", undefined);
      }
      this.forceFlushSyncState();
    } finally {
      if (this.syncGeneration === generation) {
        this.abortController = null;
      }
    }
  }

  async syncIncremental(options?: Omit<SyncOptions, "mode">): Promise<void> {
    await this.syncAll({ ...options, mode: "incremental" });
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private async runT1(signal: AbortSignal): Promise<void> {
    this.checkAborted(signal);
    this.updateSyncState("genres", "t1");
    const genreResult = await workerHttpClient<GenresResponse>("/getGenres");
    this.checkAborted(signal);
    const genres = genreResult.data.genres.genre ?? [];
    await bulkPutInChunks(db.genres, genres, signal);

    this.checkAborted(signal);
    this.updateSyncState("playlists", "t1");
    const playlistsResult =
      await workerHttpClient<PlaylistsResponse>("/getPlaylists");
    this.checkAborted(signal);
    const playlists = playlistsResult.data.playlists.playlist ?? [];
    const playlistRows = playlists.map(withStarredAt);
    await bulkPutInChunks(db.playlists, playlistRows, signal);
    await this.syncPlaylistDetails(playlistRows, signal);

    this.checkAborted(signal);
    this.updateSyncState("favorites", "t1");
    const starredResult =
      await workerHttpClient<FavoritesResponse>("/getStarred2");
    this.checkAborted(signal);
    const starredSongs = starredResult.data.starred2?.song ?? [];
    const starredIds = new Set(
      starredSongs.map((song: { id: string }) => song.id),
    );

    const previouslyStarred = await db.songs
      .where("starredAt")
      .above(0)
      .primaryKeys();
    if (previouslyStarred.length > 0) {
      await Promise.all(
        previouslyStarred
          .filter((songId) => !starredIds.has(songId))
          .map((songId) =>
            db.songs.update(songId, {
              starred: undefined,
              starredAt: undefined,
            }),
          ),
      );
    }
    if (starredSongs.length > 0) {
      await bulkPutInChunks(
        db.songs,
        starredSongs.map(
          (s: { played?: string; starred?: string; [k: string]: unknown }) =>
            withPlayedAt(withStarredAt(s)),
        ),
        signal,
      );
    }

    await this.recordTierCheckpoint("t1");
    this.forceFlushSyncState();
    this.onInvalidateQueries?.([
      ["playlists"],
      ["playlists", "single"],
      ["genres"],
      ["favorites", "count"],
      ["favorites", "list"],
      ["songs"],
    ]);
  }

  private async runT2(signal: AbortSignal): Promise<void> {
    this.checkAborted(signal);
    this.updateSyncState("artists", "t2");
    const artistsResult =
      await workerHttpClient<ArtistsResponse>("/getArtists");
    this.checkAborted(signal);
    const artistsList: ISimilarArtist[] = [];
    artistsResult.data.artists.index.forEach(
      (item: { artist: ISimilarArtist[] }) => {
        artistsList.push(...item.artist);
      },
    );
    artistsList.sort((a, b) => a.name.localeCompare(b.name));

    await db.transaction("rw", db.artists, async () => {
      await db.artists.clear();
      await bulkPutInChunks(db.artists, artistsList.map(withStarredAt), signal);
    });

    this.checkAborted(signal);
    this.updateSyncState("albums", "t2");
    const allAlbums: AlbumSummary[] = [];
    let albumOffset = 0;
    const albumPageSize = 500;
    let hasMoreAlbums = true;

    while (hasMoreAlbums) {
      this.checkAborted(signal);

      const result = await workerHttpClient<AlbumListResponse>(
        "/getAlbumList2",
        {
          query: {
            type: "alphabeticalByName",
            size: albumPageSize.toString(),
            offset: albumOffset.toString(),
          },
        },
      );

      const list = result.data.albumList2.album;
      if (!list || list.length === 0) {
        hasMoreAlbums = false;
      } else {
        for (const album of list) {
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
            played: album.played,
            playCount: album.playCount,
            starred: album.starred,
          });
        }
        this.updateSyncState(
          "albums",
          "t2",
          allAlbums.length,
          result.count || allAlbums.length,
        );
        albumOffset += albumPageSize;
        if (list.length < albumPageSize) {
          hasMoreAlbums = false;
        }
      }
    }

    await db.transaction("rw", db.albums, async () => {
      await db.albums.clear();
      await bulkPutInChunks(db.albums, allAlbums.map(withStarredAt), signal);
    });

    await this.recordTierCheckpoint("t2");
    this.forceFlushSyncState();
    this.onInvalidateQueries?.([["artists"], ["albums"]]);
  }

  private async runT3(signal: AbortSignal, songCount: number): Promise<void> {
    this.checkAborted(signal);
    this.updateSyncState("songs", "t3");

    const config = workerEnsureAuth();
    const searchAllQuery = config.serverType === "navidrome" ? '""' : "";
    const searchResult = await workerHttpClient<ISearchResponse>("/search3", {
      query: {
        query: searchAllQuery,
        artistCount: "0",
        artistOffset: "0",
        albumCount: "0",
        albumOffset: "0",
        songCount: songCount.toString(),
        songOffset: "0",
      },
    });

    this.checkAborted(signal);
    const songs = searchResult.data.searchResult3?.song ?? [];

    if (songs.length > 0) {
      const serverIds = new Set(songs.map((s: { id: string }) => s.id));
      const allExistingKeys = await db.songs.toCollection().primaryKeys();
      const staleIds = allExistingKeys.filter(
        (id) => !serverIds.has(id as string),
      );
      if (staleIds.length > 0) {
        await db.songs.bulkDelete(staleIds);
      }
    }

    const rows = songs.map(
      (s: { played?: string; starred?: string; [k: string]: unknown }) =>
        withPlayedAt(withStarredAt(s)),
    );
    await bulkPutInChunks(db.songs, rows, signal);
    this.updateSyncState("songs", "t3", songs.length, songs.length);

    await this.recordTierCheckpoint("t3");

    await this.reconcileRemovedFromServer();

    this.forceFlushSyncState();
    this.onInvalidateQueries?.([
      ["songs"],
      ["favorites", "count"],
      ["favorites", "list"],
    ]);
  }

  private async syncCoverArt(
    useAlbumCoverForSongs: boolean,
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    const coverArtIds = new Set<string>();
    await db.artists.each((a) => {
      if (a.coverArt) coverArtIds.add(a.coverArt);
    });
    await db.albums.each((a) => {
      if (a.coverArt) coverArtIds.add(a.coverArt);
    });
    if (!useAlbumCoverForSongs) {
      await db.songs.each((s) => {
        if (s.coverArt) coverArtIds.add(s.coverArt);
      });
    }

    const queue = Array.from(coverArtIds);
    let completed = 0;
    for (const coverArtId of queue) {
      try {
        await this.cacheCover(coverArtId, "700");
      } catch (err) {
        console.warn(
          `[cacheManager] failed to cache cover ${coverArtId}:`,
          err,
        );
      }
      completed += 1;
      onProgress?.(completed, queue.length);
    }

    if (useAlbumCoverForSongs) {
      const albums = await db.albums.toArray();
      for (const album of albums) {
        if (!album.id || album.id === album.coverArt) continue;

        const key = coverKey(album.id);
        const existing = await db.cacheMeta.get(key);
        if (existing) continue;

        try {
          const blob = await cacheStorageGet(coverKey(album.coverArt));
          if (blob) {
            await cacheStoragePut(key, blob, blob.type || "image/jpeg");
            await db.cacheMeta.put({
              key,
              id: album.id,
              type: "cover",
              source: "explicit",
              coverSize: "700",
              sizeBytes: blob.size,
              cachedAt: Date.now(),
              lastAccessedAt: Date.now(),
            });
          } else {
            await this.cacheCover(album.id, "700");
          }
        } catch (err) {
          console.warn(
            `[cacheManager] failed to alias cover ${album.id}:`,
            err,
          );
        }
      }
    }
  }

  private async cacheCover(coverArtId: string, size = "700"): Promise<void> {
    const key = coverKey(coverArtId);
    const existing = await db.cacheMeta.get(key);
    if (existing) {
      const sizeNum = Number.parseInt(size, 10);
      const existingSize = Number.parseInt(existing.coverSize || "0", 10);
      if (existingSize >= sizeNum) return;
    }

    const url = buildCoverArtUrl(workerEnsureAuth(), coverArtId, "album", size);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch cover art for ${coverArtId}: ${response.status}`,
      );
    }
    const blob = await response.blob();

    await cacheStoragePut(key, blob, blob.type || "image/jpeg");
    await db.cacheMeta.put({
      key,
      id: coverArtId,
      type: "cover",
      source: "explicit",
      coverSize: size,
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    });
  }

  private async reconcileRemovedFromServer(): Promise<void> {
    const songCount = await db.songs.count();
    if (songCount === 0) return;

    const cachedItems = await db.cacheMeta
      .where("type")
      .equals("audio")
      .toArray();

    if (cachedItems.length === 0) return;

    const cachedIds = cachedItems.map((item) => item.id);
    const existingServerIds = new Set(
      await db.songs.where("id").anyOf(cachedIds).primaryKeys(),
    );

    const updates: CacheMetaRow[] = [];
    for (const item of cachedItems) {
      const existsOnServer = existingServerIds.has(item.id);
      const shouldMarkRemoved = !existsOnServer;
      if (shouldMarkRemoved !== Boolean(item.removedFromServer)) {
        updates.push({
          ...item,
          removedFromServer: shouldMarkRemoved || undefined,
        });
      }
    }

    if (updates.length > 0) {
      await db.cacheMeta.bulkPut(updates);
    }
  }
}

let service: SyncWorkerService;

function init(): void {
  db = new LibraryDB();
  service = new SyncWorkerService();
  expose(service);
}

init();
