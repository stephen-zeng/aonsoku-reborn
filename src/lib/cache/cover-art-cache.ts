import { clear as idbClear, createStore, del, get, getMany, keys, set } from "idb-keyval";
import { useAppStore } from "@/store/app.store";

// ─── Constants ─────────────────────────────────────────────────────────────

const COVER_ART_DB_V2 = "aonsoku-cover-art-cache-v2";
const BLOB_STORE_NAME = "blobs";
const MAX_CACHE_BYTES = 512 * 1024 * 1024; // 512 MB

// ─── IDB stores ────────────────────────────────────────────────────────────

const blobStore = createStore(COVER_ART_DB_V2, BLOB_STORE_NAME);

// Legacy v1 store — used only for one-time cleanup
const legacyStore = createStore("aonsoku-cover-art-cache", "blobs");

// ─── Entry shape ───────────────────────────────────────────────────────────

interface CoverArtEntry {
  blob: Blob;
  size: number; // blob.size in bytes
  cachedAt: number; // Date.now() when stored
  lastAccessed: number; // Date.now() when last read
}

// ─── Scope helper ──────────────────────────────────────────────────────────

/**
 * Returns the current cache scope: "<serverUrl>|<username>".
 * Both values are already normalised (trailing-slash-free) in the store.
 */
export function getCurrentScope(): string {
  const { url, username } = useAppStore.getState().data;
  return `${url}|${username}`;
}

// ─── Size normalization ────────────────────────────────────────────────────

/**
 * Normalise a requested pixel size to one of three canonical sizes.
 * ≤ 100 → "100", 101–300 → "300", > 300 → "700"
 */
export function normalizeSize(size: string | number): string {
  const n = typeof size === "number" ? size : parseInt(size, 10);
  if (isNaN(n) || n <= 100) return "100";
  if (n <= 300) return "300";
  return "700";
}

// ─── Key helpers ───────────────────────────────────────────────────────────

function cacheKey(scope: string, id: string, normalizedSize: string): string {
  return `${scope}|${id}|${normalizedSize}`;
}

// ─── Single-flight registry ────────────────────────────────────────────────

const inflightFetches = new Map<string, Promise<Blob | null>>();

// ─── Running total (avoids O(n) full-scan on every write) ──────────────────

let cachedBytes = 0;
let cachedBytesInitialized = false;
// Single-flight for initialization: prevents concurrent calls from
// each independently scanning IDB and double-counting bytes.
let initPromise: Promise<void> | null = null;

async function ensureCachedBytesInitialized(): Promise<void> {
  if (cachedBytesInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const allKeys = (await keys(blobStore)) as string[];
        const entries = await getMany(allKeys, blobStore);
        let total = 0;
        for (const entry of entries) {
          const e = entry as CoverArtEntry | undefined;
          if (e) total += e.size;
        }
        cachedBytes = total;
      } catch {
        cachedBytes = 0;
      }
      cachedBytesInitialized = true;
    })();
  }
  return initPromise;
}

// ─── Core read ─────────────────────────────────────────────────────────────

async function getBlob(
  scope: string,
  id: string,
  size: string,
): Promise<Blob | null> {
  try {
    const normalizedSize = normalizeSize(size);
    const key = cacheKey(scope, id, normalizedSize);
    const entry = await get<CoverArtEntry>(key, blobStore);
    if (!entry) return null;
    // Update lastAccessed so eviction is truly LRU, not FIFO.
    entry.lastAccessed = Date.now();
    set(key, entry, blobStore).catch(() => {});
    return entry.blob;
  } catch {
    return null;
  }
}

/**
 * Find the best available blob for a given scope + coverArt id,
 * regardless of size. Used for offline fallback.
 * Prefers 300 → 700 → 100.
 */
async function getBestAvailableBlob(
  scope: string,
  id: string,
): Promise<Blob | null> {
  try {
    const keys300 = cacheKey(scope, id, "300");
    const keys700 = cacheKey(scope, id, "700");
    const keys100 = cacheKey(scope, id, "100");
    const [e300, e700, e100] = await getMany<CoverArtEntry | undefined>(
      [keys300, keys700, keys100],
      blobStore,
    );
    return (e300 ?? e700 ?? e100)?.blob ?? null;
  } catch {
    return null;
  }
}

// ─── Core write ────────────────────────────────────────────────────────────

/**
 * Download and store a cover art blob.
 * Single-flight: concurrent calls for the same key share one fetch.
 * Returns the fetched blob, or null if already cached / fetch failed.
 */
async function putBlob(
  scope: string,
  id: string,
  size: string,
  url: string,
): Promise<Blob | null> {
  try {
    const normalizedSize = normalizeSize(size);
    const key = cacheKey(scope, id, normalizedSize);

    // Single-flight check first (O(1)) before any IDB round-trip
    const inflight = inflightFetches.get(key);
    if (inflight) return await inflight;

    // Register the promise BEFORE the first await so that any concurrent
    // caller arriving in the same microtask turn sees the in-flight entry.
    const { promise: fetchPromise, resolve: resolvePromise } =
      Promise.withResolvers<Blob | null>();
    inflightFetches.set(key, fetchPromise);

    (async (): Promise<void> => {
      try {
        // Pre-existence check
        const existing = await get<CoverArtEntry>(key, blobStore);
        if (existing) {
          resolvePromise(null);
          return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          resolvePromise(null);
          return;
        }

        const blob = await response.blob();
        const now = Date.now();
        const entry: CoverArtEntry = {
          blob,
          size: blob.size,
          cachedAt: now,
          lastAccessed: now,
        };
        await set(key, entry, blobStore);

        await ensureCachedBytesInitialized();
        cachedBytes += blob.size;

        // Evict if over capacity (fire-and-forget)
        if (cachedBytes > MAX_CACHE_BYTES) evictIfNeeded().catch(() => {});

        resolvePromise(blob);
      } catch {
        resolvePromise(null);
      } finally {
        inflightFetches.delete(key);
      }
    })();

    return await fetchPromise;
  } catch {
    // Caching is best-effort
    return null;
  }
}

// ─── LRU Eviction ──────────────────────────────────────────────────────────

async function evictIfNeeded(): Promise<void> {
  try {
    const allKeys = (await keys(blobStore)) as string[];
    const entries = await getMany(allKeys, blobStore);

    let totalSize = 0;
    const items: { key: string; size: number; lastAccessed: number }[] = [];

    for (let i = 0; i < allKeys.length; i++) {
      const entry = entries[i] as CoverArtEntry | undefined;
      if (!entry) continue;
      totalSize += entry.size;
      items.push({
        key: allKeys[i],
        size: entry.size,
        lastAccessed: entry.lastAccessed ?? entry.cachedAt,
      });
    }

    if (totalSize <= MAX_CACHE_BYTES) {
      cachedBytes = totalSize;
      return;
    }

    // Sort by lastAccessed ascending (oldest first = evict first)
    items.sort((a, b) => a.lastAccessed - b.lastAccessed);

    for (const item of items) {
      if (totalSize <= MAX_CACHE_BYTES) break;
      await del(item.key, blobStore);
      totalSize -= item.size;
    }

    cachedBytes = totalSize;
  } catch {
    // Eviction is best-effort
  }
}

async function getTotalSize(): Promise<number> {
  await ensureCachedBytesInitialized();
  return cachedBytes;
}

// ─── Cache management ──────────────────────────────────────────────────────

async function clear(): Promise<void> {
  try {
    await idbClear(blobStore);
    cachedBytes = 0;
    cachedBytesInitialized = true;
    // Also wipe the legacy v1 store
    await clearLegacyStore();
  } catch {
    // Best-effort
  }
}

async function getEntryCount(): Promise<number> {
  try {
    const allKeys = await keys(blobStore);
    return allKeys.length;
  } catch {
    return 0;
  }
}

// ─── Legacy v1 migration ────────────────────────────────────────────────────

async function clearLegacyStore(): Promise<void> {
  try {
    await idbClear(legacyStore);
  } catch {
    // Best-effort
  }
}

// One-time cleanup of legacy v1 data on module load (non-blocking)
clearLegacyStore().catch(() => {});

// ─── Public API ─────────────────────────────────────────────────────────────

export const coverArtCache = {
  /** Read a cached blob by scope + id + size. */
  getBlob,
  /**
   * Find the best available blob for scope + id, regardless of size.
   * Used for offline fallback when the exact size is not cached.
   */
  getBestAvailableBlob,
  /** Download and store a blob. Single-flight. Returns the blob, or null if already cached / failed. */
  putBlob,
  /** Clear ALL cached blobs (global, not scoped). Also wipes legacy store. */
  clear,
  /** Number of stored entries (v2 store only). */
  getEntryCount,
  /** Total bytes stored across all entries (from in-memory running total). */
  getTotalSize,
  /** Expose size normalizer for use in hook and sync. */
  normalizeSize,
  /** Build the current user's cache scope key. */
  getCurrentScope,
};
