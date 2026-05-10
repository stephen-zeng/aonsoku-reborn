import { wrap, expose, transfer, type Remote } from "comlink";
import { useAppStore } from "@/store/app.store";
import {
  getCacheIndexActions,
  getCacheIndexItems,
} from "@/store/cache-index.store";
import { useCacheStore } from "@/store/cache.store";
import { audioKey } from "@/service/cache/cache-keys";
import { AudioCacheQueue } from "@/service/cache/audio-cache-queue";
import { cacheStorage } from "@/service/cache/cache-storage";
import { persistCacheMeta } from "@/service/cache/persist-meta";
import { subsonic } from "@/service/subsonic";
import { libraryDb } from "@/store/library-db";
import { getSongStreamUrl } from "@/api/httpClient";
import type { CachedItemMeta, CacheTask } from "@/types/cache";
import type { AuthType } from "@/types/serverConfig";

/* ── Types ─────────────────────────────────────────────────────── */

interface WorkerAuthConfig {
  url: string;
  username: string;
  password: string;
  authType: AuthType | null;
  protocolVersion?: string;
  serverType?: string | null;
}

interface AudioCacheWorkerService {
  cacheSong(task: CacheTask): Promise<void>;
  cancelAll(): void;
  initAuth(config: WorkerAuthConfig): void;
  updateAuth(config: WorkerAuthConfig): void;
  setCallbackPort(port: MessagePort): void;
}

interface Callbacks {
  onProgress(songId: string, loaded: number, total: number): void;
  onBytesReceived(songId: string, bytes: number): void;
  onCompleted(songId: string, meta: CachedItemMeta): void;
  onError(songId: string, message: string): void;
}

/** Shared interface for both Worker and fallback implementations. */
interface AudioCacheDownloader {
  cacheSong(task: CacheTask): Promise<void>;
  cancelAll(): void;
  isQueued(songId: string): boolean;
  isInFlight(songId: string): boolean;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function buildAuthConfig(
  data?: Parameters<typeof useAppStore.getState>[0]["data"],
): WorkerAuthConfig {
  const d = data ?? useAppStore.getState().data;
  return {
    url: d.url,
    username: d.username,
    password: d.password,
    authType: d.authType,
    protocolVersion: d.protocolVersion,
    serverType: d.serverType,
  };
}

function refreshCacheStatsFromIndex(): void {
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

/* ── Main-thread fallback ──────────────────────────────────────── */

class MainThreadAudioCacheEngine implements AudioCacheDownloader {
  private readonly queue: AudioCacheQueue;
  private downloadClearTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor() {
    this.queue = new AudioCacheQueue((task) => this.executeDownload(task), 4);
  }

  private scheduleClearDownloadProgress(songId: string): void {
    const existing = this.downloadClearTimers.get(songId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.downloadClearTimers.delete(songId);
      getCacheIndexActions().clearDownloadProgress(songId);
    }, 2000);
    this.downloadClearTimers.set(songId, timer);
  }

  private createProgressCallbacks(songId: string) {
    const actions = getCacheIndexActions();
    return {
      onProgress: (loaded: number, total: number) => {
        actions.setDownloadProgress(songId, Math.round((loaded / total) * 100));
      },
      onBytesReceived: (bytes: number) => {
        actions.setDownloadProgress(songId, -bytes);
      },
    };
  }

  private async readResponseWithProgress(
    response: Response,
    onProgress?: (loaded: number, total: number) => void,
    onBytesReceived?: (bytes: number) => void,
  ): Promise<Blob> {
    const contentLengthHeader = response.headers.get("Content-Length");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
    const hasValidContentLength =
      contentLengthHeader !== null &&
      !Number.isNaN(contentLength) &&
      contentLength > 0;
    const reader = response.body?.getReader();

    if (!reader || !hasValidContentLength) {
      if (!reader) {
        return response.blob();
      }

      let received = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          onBytesReceived?.(received);
        }
      } finally {
        reader.releaseLock();
      }
      return new Blob(chunks);
    }

    let received = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress?.(received, contentLength);
      }
    } catch (err) {
      if (received < contentLength) {
        throw err;
      }
    } finally {
      reader.releaseLock();
    }

    onProgress?.(contentLength, contentLength);
    return new Blob(chunks);
  }

  private async executeDownload(task: CacheTask): Promise<void> {
    const { songId, source, triggers } = task;
    const url = `${getSongStreamUrl(songId)}&_c=1`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch audio for ${songId}: ${response.status}`,
      );
    }

    const { onProgress, onBytesReceived } =
      this.createProgressCallbacks(songId);
    const blob = await this.readResponseWithProgress(
      response,
      onProgress,
      onBytesReceived,
    );

    const key = audioKey(songId);
    await cacheStorage.put(key, blob, blob.type || "audio/mpeg");

    const meta: CachedItemMeta = {
      id: songId,
      type: "audio",
      source,
      triggers,
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    getCacheIndexActions().addItem(key, meta);
    refreshCacheStatsFromIndex();
    persistCacheMeta(key, { key, ...meta });

    // Fire-and-forget lyrics
    this.cacheLyrics(songId).catch((err) => {
      console.warn(`[cacheManager] lyrics prefetch failed for ${songId}:`, err);
    });

    this.scheduleClearDownloadProgress(songId);
  }

  private async cacheLyrics(songId: string): Promise<void> {
    const existing = await libraryDb.lyrics.get(songId);
    if (existing) return;

    const structured = await subsonic.lyrics.getStructuredLyrics(songId);
    if (!structured || structured.length === 0) return;

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

  cacheSong(task: CacheTask): Promise<void> {
    return this.queue.enqueue(task);
  }

  cancelAll(): void {
    this.queue.clear();
  }

  isQueued(songId: string): boolean {
    return this.queue.isQueued(songId);
  }

  isInFlight(songId: string): boolean {
    return this.queue.isInFlight(songId);
  }
}

/* ── Worker Adapter (Comlink) ──────────────────────────────────── */

class AudioCacheWorkerAdapter implements AudioCacheDownloader {
  private worker: Worker;
  private proxy: Remote<AudioCacheWorkerService>;
  private unsubAuth: (() => void) | null = null;
  private callbackPort: MessagePort | null = null;
  private lastServerUrl: string;

  constructor() {
    this.worker = new Worker(
      new URL("./audio-cache.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onerror = (event) => {
      console.error("[audioCacheWorkerAdapter] Worker error:", event.message);
    };

    this.proxy = wrap<AudioCacheWorkerService>(this.worker);

    const initialConfig = buildAuthConfig();
    this.lastServerUrl = initialConfig.url;
    this.setupCallbacks();
    this.proxy.initAuth(initialConfig);

    this.unsubAuth = useAppStore.subscribe((state) => {
      const config = buildAuthConfig(state.data);
      if (config.url !== this.lastServerUrl) {
        this.lastServerUrl = config.url;
        this.proxy.cancelAll();
      }
      this.proxy.updateAuth(config);
    });
  }

  private setupCallbacks(): void {
    const { port1, port2 } = new MessageChannel();
    this.callbackPort = port1;

    const callbacks: Callbacks = {
      onProgress(songId: string, loaded: number, total: number) {
        getCacheIndexActions().setDownloadProgress(
          songId,
          Math.round((loaded / total) * 100),
        );
      },
      onBytesReceived(songId: string, bytes: number) {
        getCacheIndexActions().setDownloadProgress(songId, -bytes);
      },
      onCompleted(songId: string, meta: CachedItemMeta) {
        const key = audioKey(songId);
        getCacheIndexActions().addItem(key, meta);
        refreshCacheStatsFromIndex();

        // Clear progress after a brief grace period
        setTimeout(() => {
          getCacheIndexActions().clearDownloadProgress(songId);
        }, 2000);
      },
      onError(songId: string, message: string) {
        getCacheIndexActions().clearDownloadProgress(songId);
        console.warn(
          `[audioCacheWorkerAdapter] download error for ${songId}: ${message}`,
        );
      },
    };

    expose(callbacks, port1);
    this.proxy.setCallbackPort(transfer(port2, [port2]));
  }

  cacheSong(task: CacheTask): Promise<void> {
    return this.proxy.cacheSong(task);
  }

  cancelAll(): void {
    this.proxy.cancelAll();
  }

  isQueued(songId: string): boolean {
    return this.proxy.isQueued(songId);
  }

  isInFlight(songId: string): boolean {
    return this.proxy.isInFlight(songId);
  }

  terminate(): void {
    this.unsubAuth?.();
    this.callbackPort?.close();
    this.worker.terminate();
  }
}

/* ── Singleton ─────────────────────────────────────────────────── */

let audioCacheService: AudioCacheDownloader;

try {
  if (typeof Worker !== "undefined") {
    audioCacheService = new AudioCacheWorkerAdapter();
  } else {
    audioCacheService = new MainThreadAudioCacheEngine();
  }
} catch (err) {
  console.warn(
    "[audioCacheWorkerAdapter] failed to create Worker, falling back to main thread:",
    err,
  );
  audioCacheService = new MainThreadAudioCacheEngine();
}

export { audioCacheService };
export type { AudioCacheDownloader };
