import {
  getCoverArtUrl,
  getDownloadUrl,
  getSongStreamUrl,
} from "@/api/httpClient";
import { getSongCoverArtId } from "@/utils/coverArt";
import { subsonic } from "@/service/subsonic";
import { useCacheStore } from "@/store/cache.store";
import { usePlayerStore } from "@/store/player.store";
import {
  getCacheIndexActions,
  getCacheIndexItems,
  isAudioCached,
  isCoverCached,
  useCacheIndexStore,
} from "@/store/cache-index.store";
import { libraryDb } from "@/store/library-db";
import {
  CachedItemMeta,
  CacheMetaSource,
  DownloadQuality,
  QUALITY_MAX_BITRATE,
} from "@/types/cache";
import { COVER_PREFIX, audioKey, coverKey, isOldCoverKey } from "./cache-keys";
import { cacheStorage } from "./cache-storage";
import { computeEvictionPlan } from "./eviction";
import { syncService } from "./sync-worker-adapter";

/**
 * Build a URL for fetching audio at the requested quality.
 * - "original" → /download (raw file, no transcode)
 * - "high" / "medium" / "low" → /stream with a maxBitRate cap
 *
 * `purpose: "cache"` adds a `_c=1` query param so the Service Worker's
 * stale-while-revalidate API cache doesn't collide with a concurrent
 * stream request for the same song.
 */
export function buildAudioUrl(
  songId: string,
  quality: DownloadQuality,
  purpose: "cache" | "stream",
): string {
  if (quality === "original") {
    const url = getDownloadUrl(songId);
    return purpose === "cache" ? `${url}&_c=1` : url;
  }
  const bitRate = QUALITY_MAX_BITRATE[quality].toString();
  const url = getSongStreamUrl(songId, bitRate);
  return purpose === "cache" ? `${url}&_c=1` : url;
}

class CacheManager {
  private statsTimer: ReturnType<typeof setTimeout> | null = null;

  private resolveDownloadUrl(songId: string): string {
    const quality = useCacheStore.getState().settings.downloadQuality;
    return buildAudioUrl(songId, quality, "cache");
  }

  async cacheSong(songId: string): Promise<void> {
    if (isAudioCached(songId)) return;

    const quality = useCacheStore.getState().settings.downloadQuality;
    const url = this.resolveDownloadUrl(songId);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch audio for ${songId}: ${response.status}`,
      );
    }

    const blob = await response.blob();
    const key = audioKey(songId);
    await cacheStorage.put(key, blob, blob.type || "audio/mpeg");

    const meta: CachedItemMeta = {
      id: songId,
      type: "audio",
      source: "explicit",
      quality,
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
    getCacheIndexActions().addItem(key, meta);
    this.scheduleStatsRefresh();

    // Bundle structured lyrics with the audio so offline playback shows
    // them without another network trip. Fire-and-forget: lyrics are a
    // nice-to-have, never worth failing the cache operation over.
    this.cacheLyrics(songId).catch((err) => {
      console.warn(`[cacheManager] lyrics prefetch failed for ${songId}:`, err);
    });
  }

  /**
   * Download `songId` and tag it as a smart-download, carrying the
   * rule names that triggered the decision. Used by the
   * SmartDownloadEngine (P5). If the song is already cached as
   * `"explicit"` we leave it alone — the user decided manually, we
   * don't demote them. If it's `"lru"` we upgrade the entry to
   * `"smart"` so future LRU pressure doesn't evict it.
   */
  async cacheSmartSong(songId: string, triggers: string[]): Promise<void> {
    const key = audioKey(songId);
    const existing = getCacheIndexItems()[key];

    if (existing) {
      if (existing.source === "explicit") return; // user already owns it
      if (existing.source === "smart") {
        // Refresh triggers so "why is this cached?" stays accurate.
        getCacheIndexActions().addItem(key, {
          ...existing,
          triggers,
          lastAccessedAt: Date.now(),
        });
        return;
      }
      if (existing.source === "lru") {
        getCacheIndexActions().addItem(key, {
          ...existing,
          source: "smart",
          triggers,
          lastAccessedAt: Date.now(),
        });
        return;
      }
    }

    const quality = useCacheStore.getState().settings.downloadQuality;
    const url = this.resolveDownloadUrl(songId);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Smart-download failed for ${songId}: ${response.status}`,
      );
    }

    const blob = await response.blob();
    await cacheStorage.put(key, blob, blob.type || "audio/mpeg");

    const meta: CachedItemMeta = {
      id: songId,
      type: "audio",
      source: "smart",
      triggers,
      quality,
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
    getCacheIndexActions().addItem(key, meta);
    this.scheduleStatsRefresh();

    // Same rationale as cacheSong: bring lyrics along.
    this.cacheLyrics(songId).catch(() => {});
  }

  /**
   * Fetch and store structured lyrics for a song in `libraryDb.lyrics`.
   * Called after `cacheSong` so explicit/smart downloads bring their
   * lyrics along for offline playback. Silently returns when the
   * server doesn't have lyrics for this song or when they are already
   * cached.
   */
  async cacheLyrics(songId: string): Promise<void> {
    const existing = await libraryDb.lyrics.get(songId);
    if (existing) return;

    const structured = await subsonic.lyrics.getStructuredLyrics(songId);
    if (!structured || structured.length === 0) return;

    // Pick the first (usually the source-language) entry and store its
    // lines as a JSON blob for simplicity. `synced` is true iff at
    // least one line carries a `start` timestamp.
    const primary = structured[0];
    const synced = primary.line.some((l) => typeof l.start === "number");
    const content = JSON.stringify(structured);
    const now = Date.now();

    await libraryDb.lyrics.put({
      songId,
      content,
      synced,
      cachedAt: now,
      lastAccessedAt: now,
    });
  }

  async getCachedAudioUrl(songId: string): Promise<string | null> {
    const key = audioKey(songId);

    // Fast path: when the index is loaded and the key is absent, the
    // blob cannot exist in the Cache API — skip the async lookup.
    const { loaded } = useCacheIndexStore.getState();
    if (loaded && !isAudioCached(songId)) return null;

    // Slow path (index not loaded yet, or index says cached): read the
    // Cache API directly.  This ensures offline audio is playable
    // immediately on app startup before loadFromIDB completes.
    const blob = await cacheStorage.get(key);
    if (!blob) {
      if (isAudioCached(songId)) {
        getCacheIndexActions().removeItem(key);
      }
      return null;
    }

    // If the blob exists but the in-memory index missed it (e.g.
    // loadFromIDB has not completed yet), try to recover the original
    // metadata from Dexie cacheMeta.  Falls back to a synthetic entry
    // only when no persisted metadata exists.
    if (!isAudioCached(songId)) {
      const existingRow = await libraryDb.cacheMeta.get(key);
      if (existingRow) {
        getCacheIndexActions().addItem(key, {
          id: existingRow.id,
          type: existingRow.type,
          source: existingRow.source,
          triggers: existingRow.triggers,
          quality: existingRow.quality as DownloadQuality | undefined,
          sizeBytes: existingRow.sizeBytes,
          cachedAt: existingRow.cachedAt,
          lastAccessedAt: Date.now(),
          removedFromServer: existingRow.removedFromServer,
        });
      } else {
        getCacheIndexActions().addItem(key, {
          id: songId,
          type: "audio",
          source: "explicit",
          sizeBytes: blob.size,
          cachedAt: Date.now(),
          lastAccessedAt: Date.now(),
        });
      }
    } else {
      getCacheIndexActions().touchItem(key);
    }

    return URL.createObjectURL(blob);
  }

  async cacheCover(coverArtId: string, size = "700"): Promise<void> {
    const key = coverKey(coverArtId);
    const items = getCacheIndexItems();
    const existing = items[key];
    const existingSize = Number(existing?.coverSize ?? "0");
    const requestedSize = Number(size);
    const shouldReplaceExisting = existingSize < requestedSize && !!existing;

    if (existing) {
      if (existingSize >= requestedSize) return;
      await cacheStorage.delete(key);
    }

    const url = getCoverArtUrl(coverArtId, "album", size);
    if (url.startsWith("/default_")) return;

    const response = await fetch(url);
    if (!response.ok) return;

    const blob = await response.blob();

    if (shouldReplaceExisting) {
      await cacheStorage.delete(key);
    }

    await cacheStorage.put(key, blob, blob.type || "image/jpeg");

    const meta: CachedItemMeta = {
      id: coverArtId,
      type: "cover",
      source: existing?.source ?? "explicit",
      coverSize: size,
      sizeBytes: blob.size,
      cachedAt: existing?.cachedAt ?? Date.now(),
      lastAccessedAt: Date.now(),
    };
    getCacheIndexActions().addItem(key, meta);
    this.scheduleStatsRefresh();
  }

  async getCachedCoverUrl(coverArtId: string): Promise<string | null> {
    const key = coverKey(coverArtId);

    // Fast path: when the index is loaded and the key is absent, skip
    // the async Cache API lookup.
    const { loaded } = useCacheIndexStore.getState();
    if (loaded && !isCoverCached(coverArtId)) return null;

    // Slow path: read Cache API directly for the startup case where
    // the in-memory index has not finished loading from IDB yet.
    const blob = await cacheStorage.get(key);
    if (!blob) {
      if (isCoverCached(coverArtId)) {
        getCacheIndexActions().removeItem(key);
      }
      return null;
    }

    // Self-heal: if the blob exists but the index missed it, try to
    // recover the original metadata from Dexie cacheMeta.
    if (!isCoverCached(coverArtId)) {
      const existingRow = await libraryDb.cacheMeta.get(key);
      if (existingRow) {
        getCacheIndexActions().addItem(key, {
          id: existingRow.id,
          type: existingRow.type,
          source: existingRow.source,
          quality: existingRow.quality as DownloadQuality | undefined,
          coverSize: (existingRow as Record<string, unknown>).coverSize as string | undefined,
          sizeBytes: existingRow.sizeBytes,
          cachedAt: existingRow.cachedAt,
          lastAccessedAt: Date.now(),
          removedFromServer: existingRow.removedFromServer,
        });
      } else {
        getCacheIndexActions().addItem(key, {
          id: coverArtId,
          type: "cover",
          source: "explicit",
          sizeBytes: blob.size,
          cachedAt: Date.now(),
          lastAccessedAt: Date.now(),
        });
      }
    } else {
      getCacheIndexActions().touchItem(key);
    }

    return URL.createObjectURL(blob);
  }

  async syncCoverArt(onProgress?: (current: number, total: number) => void) {
    const useAlbumCoverForSongs =
      usePlayerStore.getState().settings.coverArt.useAlbumCoverForSongs;

    const [artists, albums, songs] = await Promise.all([
      libraryDb.artists.toArray(),
      libraryDb.albums.toArray(),
      libraryDb.songs.toArray(),
    ]);

    // Always cache every distinct coverArt we encounter, regardless of
    // useAlbumCoverForSongs.  When the setting is on, resolveCacheKey
    // resolves song covers to albumId, so we must also ensure album.id
    // is present in the cache (copying the album.coverArt blob when the
    // two IDs differ).  This guarantees offline lookups never miss.
    const queue = Array.from(
      new Set(
        [
          ...artists.map((artist) => artist.coverArt),
          ...albums.map((album) => album.coverArt),
          ...songs.map((song) => song.coverArt),
        ].filter((value): value is string => Boolean(value)),
      ),
    );

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

    // When songs resolve to albumId, make sure album.id is also cached.
    if (useAlbumCoverForSongs) {
      for (const album of albums) {
        if (!album.id || album.id === album.coverArt) continue;

        const key = coverKey(album.id);
        if (isCoverCached(album.id)) continue;

        try {
          const blob = await cacheStorage.get(coverKey(album.coverArt));
          if (blob) {
            await cacheStorage.put(key, blob, blob.type || "image/jpeg");
            getCacheIndexActions().addItem(key, {
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

    await this.enforceStorageLimit();
  }

  private async cacheBulk(
    songs: { id: string; coverArt?: string; albumId?: string }[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    let completed = 0;
    for (const song of songs) {
      try {
        await this.cacheSong(song.id);
        const coverArtId = getSongCoverArtId({
          albumId: song.albumId,
          coverArt: song.coverArt ?? "",
        });
        if (coverArtId) {
          await this.cacheCover(coverArtId);
        }
      } catch (err) {
        console.error(`Failed to cache song ${song.id}:`, err);
      }
      completed++;
      onProgress?.(completed, songs.length);
    }
    await this.enforceStorageLimit();
  }

  async cacheAlbum(
    albumId: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    const album = await subsonic.albums.getOne(albumId);
    if (!album?.song) return;
    await this.cacheBulk(album.song, onProgress);
  }

  async cachePlaylist(
    playlistId: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    const playlist = await subsonic.playlists.getOne(playlistId);
    if (!playlist?.entry) return;
    await this.cacheBulk(playlist.entry, onProgress);
  }

  async cacheArtist(
    artistId: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    const artist = await subsonic.artists.getOne(artistId);
    if (!artist?.album) return;

    const results = await Promise.all(
      artist.album.map((a) => subsonic.albums.getOne(a.id)),
    );

    const songs = results.flatMap((result) => {
      if (!result) return [];
      return result.song;
    });

    await this.cacheBulk(songs, onProgress);
  }

  async enforceStorageLimit(): Promise<void> {
    const { assetsQuota, lruQuota } = useCacheStore.getState().settings;
    const items = getCacheIndexItems();
    const toEvict = computeEvictionPlan(items, {
      assets: assetsQuota,
      audioLru: lruQuota,
    });
    for (const key of toEvict) {
      await this.evictItem(key);
    }
  }

  async evictItem(key: string): Promise<void> {
    await cacheStorage.delete(key);
    getCacheIndexActions().removeItem(key);
    this.scheduleStatsRefresh();
  }

  /**
   * Clear every `type: "audio"` entry whose `source` matches. Used by
   * the per-pool clear buttons in the storage settings UI.
   */
  async clearAudioBySource(source: CacheMetaSource): Promise<void> {
    const items = getCacheIndexItems();
    const keysToDelete = Object.entries(items)
      .filter(([, meta]) => meta.type === "audio" && meta.source === source)
      .map(([key]) => key);

    await Promise.all(keysToDelete.map((key) => cacheStorage.delete(key)));
    for (const key of keysToDelete) {
      getCacheIndexActions().removeItem(key);
    }
    this.refreshStats();
  }

  /** Clear every `type: "cover"` entry regardless of source. */
  async clearAssets(): Promise<void> {
    const items = getCacheIndexItems();
    const keysToDelete = Object.entries(items)
      .filter(([, meta]) => meta.type === "cover")
      .map(([key]) => key);

    await Promise.all(keysToDelete.map((key) => cacheStorage.delete(key)));
    for (const key of keysToDelete) {
      getCacheIndexActions().removeItem(key);
    }
    this.refreshStats();
  }

  async clearAllCaches(): Promise<void> {
    // Cancel any in-flight sync to prevent the worker from writing
    // stale cacheMeta rows after we clear them.
    syncService.cancel();
    await cacheStorage.clear();
    getCacheIndexActions().clear();
    await libraryDb.lyrics.clear();
    await libraryDb.cacheMeta.clear();
    this.refreshStats();
  }

  /**
   * Walk every cached explicit/smart audio entry and sync its
   * `removedFromServer` flag against the current `libraryDb.songs`
   * table. Entries whose songId no longer exists on the server keep
   * their local blob (so offline playback stays working) but are
   * flagged so the UI can label them. If a flagged song reappears
   * on the server (folder rescan, rename undo, …), the flag is
   * cleared automatically.
   *
   * Safe to call after any sync that refreshed the songs table. If
   * the songs table is empty (e.g. `syncLibrary` off, fresh install)
   * this is a no-op — we'd otherwise mark every download as an
   * orphan, which would confuse users.
   */
  async reconcileRemovedFromServer(): Promise<void> {
    const songCount = await libraryDb.songs.count();
    if (songCount === 0) return;

    const items = getCacheIndexItems();
    const { setRemovedFromServer } = getCacheIndexActions();

    for (const [key, meta] of Object.entries(items)) {
      if (meta.type !== "audio") continue;
      const existsOnServer = (await libraryDb.songs.get(meta.id)) !== undefined;
      const shouldMarkRemoved = !existsOnServer;
      if (shouldMarkRemoved !== Boolean(meta.removedFromServer)) {
        setRemovedFromServer(key, shouldMarkRemoved);
      }
    }
  }

  private scheduleStatsRefresh(): void {
    if (this.statsTimer) return;
    this.statsTimer = setTimeout(() => {
      this.statsTimer = null;
      this.refreshStats();
    }, 300);
  }

  refreshStats(): void {
    const items = getCacheIndexItems();
    let audioSize = 0;
    let coverSize = 0;
    let audioCount = 0;
    let coverCount = 0;

    for (const meta of Object.values(items)) {
      if (meta.type === "audio") {
        audioSize += meta.sizeBytes;
        audioCount++;
      } else {
        coverSize += meta.sizeBytes;
        coverCount++;
      }
    }

    useCacheStore.getState().actions.updateCacheStats({
      audioSize,
      coverSize,
      audioCount,
      coverCount,
    });
  }

  /**
   * One-time migration: old cache keys included the size suffix
   * (e.g. `cover:al-123:300`). New keys are just `cover:<id>`.
   * For each coverArtId that has multiple old entries, keep the
   * largest size and delete the rest.
   */
  async migrateCoverCacheKeys(): Promise<void> {
    const items = getCacheIndexItems();
    const actions = getCacheIndexActions();

    const coverEntries = Object.entries(items).filter(
      ([key]) => isOldCoverKey(key),
    );

    if (coverEntries.length === 0) return;

    const byId = new Map<
      string,
      { key: string; size: string; meta: CachedItemMeta }[]
    >();
    for (const [key, meta] of coverEntries) {
      const suffix = key.slice(COVER_PREFIX.length);
      const lastColon = suffix.lastIndexOf(":");
      const id = suffix.slice(0, lastColon);
      const size = suffix.slice(lastColon + 1);
      let list = byId.get(id);
      if (!list) {
        list = [];
        byId.set(id, list);
      }
      list.push({ key, size, meta });
    }

    for (const [id, entries] of byId) {
      entries.sort((a, b) => Number(b.size) - Number(a.size));
      const best = entries[0];
      const newKey = coverKey(id);

      const blob = await cacheStorage.get(best.key);
      if (blob) {
        await cacheStorage.put(newKey, blob, blob.type || "image/jpeg");
        actions.addItem(newKey, {
          ...best.meta,
          id,
          type: "cover",
          coverSize: best.size,
        });
      }

      for (const entry of entries) {
        await cacheStorage.delete(entry.key);
        actions.removeItem(entry.key);
      }
    }

    this.refreshStats();
  }
}

export const cacheManager = new CacheManager();
