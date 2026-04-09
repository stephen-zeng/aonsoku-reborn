import {
  getCoverArtUrl,
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
import { CachedItemMeta } from "@/types/cache";
import { audioKey, coverKey } from "./cache-keys";
import { cacheStorage } from "./cache-storage";
import { computeEvictionPlan } from "./eviction";

class CacheManager {
  private queue: string[] = [];
  private processing = false;
  private maxConcurrency = 2;
  private activeDownloads = 0;
  private statsTimer: ReturnType<typeof setTimeout> | null =
    null;

  // ── Audio Caching ──

  async cacheSong(songId: string): Promise<void> {
    const mode = useCacheStore.getState().settings.mode;
    if (mode === "none") return;
    if (isAudioCached(songId)) return;

    // Extra param differentiates this from the <audio> element's identical
    // stream URL, preventing HTTP/2 multiplexing conflicts (ERR_HTTP2_PROTOCOL_ERROR).
    const url = getSongStreamUrl(songId) + "&_c=1";
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch audio for ${songId}: ${response.status}`,
      );
    }

    const blob = await response.blob();
    const key = audioKey(songId);
    await cacheStorage.put(
      key,
      blob,
      blob.type || "audio/mpeg",
    );

    const meta: CachedItemMeta = {
      id: songId,
      type: "audio",
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };
    getCacheIndexActions().addItem(key, meta);
    this.scheduleStatsRefresh();
  }

  async getCachedAudioUrl(
    songId: string,
  ): Promise<string | null> {
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

  // ── Cover Art Caching ──

  async cacheCover(
    coverArtId: string,
    size = "300",
  ): Promise<void> {
    const mode = useCacheStore.getState().settings.mode;
    if (mode === "none") return;
    if (isCoverCached(coverArtId, size)) return;

    const url = getCoverArtUrl(coverArtId, "album", size);
    if (url.startsWith("/default_")) return;

    const response = await fetch(url);
    if (!response.ok) return;

    const blob = await response.blob();
    const key = coverKey(coverArtId, size);
    await cacheStorage.put(
      key,
      blob,
      blob.type || "image/jpeg",
    );

    const meta: CachedItemMeta = {
      id: coverArtId,
      type: "cover",
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

  // ── Bulk Caching ──

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
        console.error(
          `Failed to cache song ${song.id}:`,
          err,
        );
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
    const playlist =
      await subsonic.playlists.getOne(playlistId);
    if (!playlist?.entry) return;
    await this.cacheBulk(playlist.entry, onProgress);
  }

  // ── Background Queue ──

  enqueueForCaching(songId: string): void {
    const mode = useCacheStore.getState().settings.mode;
    if (mode === "none") return;
    if (isAudioCached(songId)) return;
    if (this.queue.includes(songId)) return;

    this.queue.push(songId);
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      if (this.activeDownloads >= this.maxConcurrency) {
        await new Promise<void>((resolve) => {
          const check = () => {
            if (this.activeDownloads < this.maxConcurrency) {
              resolve();
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });
      }

      const songId = this.queue.shift();
      if (!songId) break;

      this.activeDownloads++;
      this.cacheSong(songId)
        .catch((err) => {
          console.error(
            `Background cache failed for ${songId}:`,
            err,
          );
        })
        .finally(() => {
          this.activeDownloads--;
        });
    }

    this.processing = false;
  }

  cancelQueue(): void {
    this.queue.length = 0;
  }

  // ── Eviction ──

  async enforceStorageLimit(): Promise<void> {
    const { maxCacheSize } = useCacheStore.getState().settings;
    if (maxCacheSize === 0) return;

    const items = getCacheIndexItems();
    const totalSize = Object.values(items).reduce(
      (sum, item) => sum + item.sizeBytes,
      0,
    );

    const toEvict = computeEvictionPlan(
      items,
      totalSize,
      maxCacheSize,
    );
    for (const key of toEvict) {
      await this.evictItem(key);
    }
  }

  async evictItem(key: string): Promise<void> {
    await cacheStorage.delete(key);
    getCacheIndexActions().removeItem(key);
    this.scheduleStatsRefresh();
  }

  // ── Cleanup ──

  async clearAudioCache(): Promise<void> {
    const items = getCacheIndexItems();
    const keysToDelete = Object.entries(items)
      .filter(([, meta]) => meta.type === "audio")
      .map(([key]) => key);

    await Promise.all(
      keysToDelete.map((key) => cacheStorage.delete(key)),
    );
    for (const key of keysToDelete) {
      getCacheIndexActions().removeItem(key);
    }
    this.refreshStats();
  }

  async clearCoverCache(): Promise<void> {
    const items = getCacheIndexItems();
    const keysToDelete = Object.entries(items)
      .filter(([, meta]) => meta.type === "cover")
      .map(([key]) => key);

    await Promise.all(
      keysToDelete.map((key) => cacheStorage.delete(key)),
    );
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

  // ── Stats ──

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
