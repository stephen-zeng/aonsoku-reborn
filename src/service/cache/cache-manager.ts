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
import { CachedItemMeta, CacheMetaSource } from "@/types/cache";
import { audioKey, coverKey } from "./cache-keys";
import { cacheStorage } from "./cache-storage";
import { computeEvictionPlan } from "./eviction";

class CacheManager {
  private statsTimer: ReturnType<typeof setTimeout> | null = null;

  private resolveDownloadUrl(songId: string): string {
    const quality = useCacheStore.getState().settings.downloadQuality;
    if (quality === "original") {
      return getDownloadUrl(songId);
    }
    return getSongStreamUrl(songId) + "&_c=1";
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
