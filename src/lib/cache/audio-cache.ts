import { createStore, del, get, keys, set } from "idb-keyval";

interface AudioEntry {
  blob: Blob;
  size: number;
  cachedAt: number;
  lastAccessed: number;
}

interface AudioMeta {
  songId: string;
  size: number;
  lastAccessed: number;
}

const blobStore = createStore("aonsoku-audio-cache", "blobs");
const metaStore = createStore("aonsoku-audio-meta", "meta");

const META_INDEX_KEY = "audio-meta-index";

async function getMetaIndex(): Promise<AudioMeta[]> {
  try {
    const index = await get<AudioMeta[]>(META_INDEX_KEY, metaStore);
    return index ?? [];
  } catch {
    return [];
  }
}

async function saveMetaIndex(index: AudioMeta[]): Promise<void> {
  await set(META_INDEX_KEY, index, metaStore);
}

async function getBlob(songId: string): Promise<Blob | null> {
  try {
    const entry = await get<AudioEntry>(songId, blobStore);
    if (!entry) return null;

    entry.lastAccessed = Date.now();
    set(songId, entry, blobStore).catch(() => {});

    const index = await getMetaIndex();
    const meta = index.find((m) => m.songId === songId);
    if (meta) {
      meta.lastAccessed = Date.now();
      saveMetaIndex(index).catch(() => {});
    }

    return entry.blob;
  } catch {
    return null;
  }
}

// Track in-flight fetches to prevent duplicate downloads
const inflightFetches = new Set<string>();

async function putBlob(
  songId: string,
  url: string,
  maxSize: number,
): Promise<void> {
  try {
    if (inflightFetches.has(songId)) return;

    const existing = await get<AudioEntry>(songId, blobStore);
    if (existing) return;

    inflightFetches.add(songId);

    try {
      const response = await fetch(url);
      if (!response.ok) return;

      const blob = await response.blob();
      const now = Date.now();

      const entry: AudioEntry = {
        blob,
        size: blob.size,
        cachedAt: now,
        lastAccessed: now,
      };

      await evictIfNeeded(maxSize - blob.size);

      await set(songId, entry, blobStore);

      const index = await getMetaIndex();
      index.push({
        songId,
        size: blob.size,
        lastAccessed: now,
      });
      await saveMetaIndex(index);
    } finally {
      inflightFetches.delete(songId);
    }
  } catch {
    inflightFetches.delete(songId);
  }
}

async function evictIfNeeded(targetFreeSpace: number): Promise<void> {
  try {
    const index = await getMetaIndex();
    let totalSize = index.reduce((sum, m) => sum + m.size, 0);

    if (totalSize <= targetFreeSpace) return;

    const sorted = [...index].sort((a, b) => a.lastAccessed - b.lastAccessed);

    const toRemove: string[] = [];

    for (const meta of sorted) {
      if (totalSize <= targetFreeSpace) break;
      toRemove.push(meta.songId);
      totalSize -= meta.size;
    }

    await Promise.all(toRemove.map((id) => del(id, blobStore)));

    const remaining = index.filter((m) => !toRemove.includes(m.songId));
    await saveMetaIndex(remaining);
  } catch {
    // Silently fail
  }
}

async function clear(): Promise<void> {
  const allKeys = await keys(blobStore);
  await Promise.all(allKeys.map((key) => del(key, blobStore)));
  await del(META_INDEX_KEY, metaStore);
}

async function getTotalSize(): Promise<number> {
  try {
    const index = await getMetaIndex();
    return index.reduce((sum, m) => sum + m.size, 0);
  } catch {
    return 0;
  }
}

async function getEntryCount(): Promise<number> {
  try {
    const index = await getMetaIndex();
    return index.length;
  } catch {
    return 0;
  }
}

async function getCachedSongIds(): Promise<string[]> {
  try {
    const index = await getMetaIndex();
    return index.map((m) => m.songId);
  } catch {
    return [];
  }
}

export const audioCache = {
  getBlob,
  putBlob,
  clear,
  getTotalSize,
  getEntryCount,
  getCachedSongIds,
};
