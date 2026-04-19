import {
  getCoverArtUrl,
  getDownloadUrl,
  getSongStreamUrl,
} from "@/api/httpClient";
import { subsonic } from "@/service/subsonic";
import { useCacheStore } from "@/store/cache.store";
import {
  getCacheIndexActions,
  getCacheIndexItems,
  isAudioCached,
  isCoverCached,
} from "@/store/cache-index.store";
import { libraryDb } from "@/store/library-db";
import {
  CachedItemMeta,
  CacheMetaSource,
  DownloadQuality,
  QUALITY_MAX_BITRATE,
} from "@/types/cache";
import { audioKey, coverKey } from "./cache-keys";
import { cacheStorage } from "./cache-storage";
import { computeEvictionPlan } from "./eviction";

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
    if (!isAudioCached(songId)) return null;

    const blob = await cacheStorage.get(key);
    if (!blob) {
      getCacheIndexActions().removeItem(key);
      return null;
    }

    getCacheIndexActions().touchItem(key);
    return URL.createObjectURL(blob);
  }

  async cacheCover(coverArtId: string, size = "300"): Promise<void> {
    if (isCoverCached(coverArtId, size)) return;

    const url = getCoverArtUrl(coverArtId, "album", size);
    if (url.startsWith("/default_")) return;

    const response = await fetch(url);
    if (!response.ok) return;

    const blob = await response.blob();
    const key = coverKey(coverArtId, size);
    await cacheStorage.put(key, blob, blob.type || "image/jpeg");

    const meta: CachedItemMeta = {
      id: coverArtId,
      type: "cover",
      source: "explicit",
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
    getCacheIndexActions().addItem(key, meta);
    this.scheduleStatsRefresh();
  }

  async getCachedCoverUrl(
    coverArtId: string,
    size = "300",
  ): Promise<string | null> {
    const key = coverKey(coverArtId, size);
    if (!isCoverCached(coverArtId, size)) return null;

    const blob = await cacheStorage.get(key);
    if (!blob) {
      getCacheIndexActions().removeItem(key);
      return null;
    }

    getCacheIndexActions().touchItem(key);
    return URL.createObjectURL(blob);
  }

  private async cacheBulk(
    songs: { id: string; coverArt?: string }[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    let completed = 0;
    for (const song of songs) {
      try {
        await this.cacheSong(song.id);
        if (song.coverArt) {
          await this.cacheCover(song.coverArt);
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
    await cacheStorage.clear();
    getCacheIndexActions().clear();
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
}

export const cacheManager = new CacheManager();
