import { createStore, del, get, keys, set } from "idb-keyval";

interface CoverArtEntry {
  blob: Blob;
  size: number;
  cachedAt: number;
}

const store = createStore("aonsoku-cover-art-cache", "blobs");

function cacheKey(id: string, type: string, size: string): string {
  return `${type}:${id}:${size}`;
}

async function getBlob(
  id: string,
  type: string,
  size: string,
): Promise<Blob | null> {
  try {
    const key = cacheKey(id, type, size);
    const entry = await get<CoverArtEntry>(key, store);
    return entry?.blob ?? null;
  } catch {
    return null;
  }
}

// Track in-flight fetches to prevent duplicate downloads
const inflightFetches = new Set<string>();

async function putBlob(
  id: string,
  type: string,
  size: string,
  url: string,
): Promise<void> {
  try {
    const key = cacheKey(id, type, size);

    if (inflightFetches.has(key)) return;
    inflightFetches.add(key);

    try {
      const response = await fetch(url);
      if (!response.ok) return;

      const blob = await response.blob();
      const entry: CoverArtEntry = {
        blob,
        size: blob.size,
        cachedAt: Date.now(),
      };
      await set(key, entry, store);
    } finally {
      inflightFetches.delete(key);
    }
  } catch {
    // Caching is best-effort
  }
}

async function clear(): Promise<void> {
  const allKeys = await keys(store);
  await Promise.all(allKeys.map((key) => del(key, store)));
}

async function getTotalSize(): Promise<number> {
  try {
    const allKeys = await keys(store);
    let total = 0;
    // Batch reads for better performance
    const entries = await Promise.all(
      allKeys.map((key) => get<CoverArtEntry>(key, store)),
    );
    for (const entry of entries) {
      if (entry) total += entry.size;
    }
    return total;
  } catch {
    return 0;
  }
}

async function getEntryCount(): Promise<number> {
  try {
    const allKeys = await keys(store);
    return allKeys.length;
  } catch {
    return 0;
  }
}

export const coverArtCache = {
  getBlob,
  putBlob,
  clear,
  getTotalSize,
  getEntryCount,
};
