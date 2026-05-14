import { expose, type Remote, wrap } from "comlink";
import {
  getSongStreamUrl as workerGetSongStreamUrl,
  initAuth as workerInitAuth,
  updateAuth as workerUpdateAuth,
} from "@/api/workerHttpClient";
import { AudioCacheQueue } from "@/service/cache/audio-cache-queue";
import { audioKey } from "@/service/cache/cache-keys";
import { LibraryDB } from "@/store/library-db";
import type { CachedItemMeta, CacheTask } from "@/types/cache";

interface WorkerAuthConfig {
  username: string;
  password: string;
  url: string;
  serverType?: string | null;
  authType?: string | null;
  protocolVersion?: string;
}

interface Callbacks {
  onProgress(songId: string, loaded: number, total: number): void;
  onBytesReceived(songId: string, bytes: number): void;
  onCompleted(songId: string, meta: CachedItemMeta): void;
  onError(songId: string, message: string): void;
}

// ═══════════════════════════════════════════════════════════════════
//  Cache Storage helpers (shared Cache API across main / worker)
// ═══════════════════════════════════════════════════════════════════
const CACHE_NAME = "aonsoku-media-cache";
const workerCachePromise = caches.open(CACHE_NAME);

async function getWorkerCache(): Promise<Cache> {
  return workerCachePromise;
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
  await cache.put(`/_cache/${encodeURIComponent(key)}`, response);
}

async function cacheStorageHas(key: string): Promise<boolean> {
  const cache = await getWorkerCache();
  const response = await cache.match(`/_cache/${encodeURIComponent(key)}`);
  if (response) return true;
  const legacy = await cache.match(`/_cache/${key}`);
  return legacy !== undefined;
}

// ═══════════════════════════════════════════════════════════════════
//  Streaming download with progress reporting
// ═══════════════════════════════════════════════════════════════════
async function readResponseWithProgress(
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

// ═══════════════════════════════════════════════════════════════════
//  Dexie persistence helper
// ═══════════════════════════════════════════════════════════════════
const RETRY_DELAY_MS = 200;
const MAX_RETRIES = 2;

let db: LibraryDB;

async function persistCacheMeta(
  key: string,
  meta: CachedItemMeta & { key: string },
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await db.cacheMeta.put(meta);
      return;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      } else {
        console.warn(
          `[audioCacheWorker] failed to persist cacheMeta for ${key} after ${MAX_RETRIES + 1} attempts:`,
          err,
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
//  AudioCacheWorkerService — exposed to main thread via Comlink
// ═══════════════════════════════════════════════════════════════════
class AudioCacheWorkerService {
  #abortController = new AbortController();
  #queue: AudioCacheQueue;
  #authReady: Promise<void>;
  #resolveAuthReady!: () => void;
  #callbacks: Remote<Callbacks> | null = null;

  constructor() {
    this.#queue = new AudioCacheQueue((task) => this.#executeDownload(task), 4);
    this.#authReady = new Promise((resolve) => {
      this.#resolveAuthReady = resolve;
    });
  }

  initAuth(config: WorkerAuthConfig): void {
    workerInitAuth(config);
    this.#resolveAuthReady();
  }

  updateAuth(config: WorkerAuthConfig): void {
    workerUpdateAuth(config);
  }

  setCallbackPort(port: MessagePort): void {
    this.#callbacks = wrap<Callbacks>(port);
  }

  /** Enqueue a download.  Skips if the blob is already in Cache API. */
  async cacheSong(task: CacheTask): Promise<void> {
    await this.#authReady;
    const key = audioKey(task.songId);
    if (await cacheStorageHas(key)) return;
    return this.#queue.enqueue(task);
  }

  isQueued(songId: string): boolean {
    return this.#queue.isQueued(songId);
  }

  isInFlight(songId: string): boolean {
    return this.#queue.isInFlight(songId);
  }

  /** Cancel every pending and in-flight download. */
  cancelAll(): void {
    this.#abortController.abort();
    this.#abortController = new AbortController();
    this.#queue.clear();
  }

  /** The actual fetch + store executed inside the worker. */
  async #executeDownload(task: CacheTask): Promise<void> {
    const { songId, source, triggers } = task;
    const url = `${workerGetSongStreamUrl(songId)}&_c=1`;

    let response: Response;
    try {
      response = await fetch(url, {
        signal: this.#abortController.signal,
      });
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "AbortError" || err.name === "AbortError")
      ) {
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.#callbacks?.onError(songId, msg);
      throw err;
    }

    if (!response.ok) {
      const msg = `HTTP ${response.status}`;
      this.#callbacks?.onError(songId, msg);
      throw new Error(`Failed to fetch audio for ${songId}: ${msg}`);
    }

    // Throttle progress callbacks to avoid flooding the main thread
    let lastProgressTime = 0;
    let lastBytes = 0;
    const PROGRESS_THROTTLE_MS = 200;
    const BYTES_BATCH = 256_000;

    const blob = await readResponseWithProgress(
      response,
      (loaded, total) => {
        const now = performance.now();
        if (now - lastProgressTime > PROGRESS_THROTTLE_MS) {
          lastProgressTime = now;
          this.#callbacks?.onProgress(songId, loaded, total);
        }
      },
      (bytes) => {
        if (bytes - lastBytes > BYTES_BATCH) {
          lastBytes = bytes;
          this.#callbacks?.onBytesReceived(songId, bytes);
        }
      },
    );

    const key = audioKey(songId);
    await cacheStoragePut(key, blob, blob.type || "audio/mpeg");

    const meta: CachedItemMeta = {
      id: songId,
      type: "audio",
      source,
      triggers,
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    await persistCacheMeta(key, { key, ...meta });
    this.#callbacks?.onCompleted(songId, meta);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Bootstrap
// ═══════════════════════════════════════════════════════════════════
let service: AudioCacheWorkerService;

function init(): void {
  try {
    db = new LibraryDB();
    service = new AudioCacheWorkerService();
    expose(service);
  } catch (err) {
    console.error("[audioCacheWorker] bootstrap failed:", err);
    self.postMessage({ type: "worker-init-error", error: String(err) });
  }
}

init();
