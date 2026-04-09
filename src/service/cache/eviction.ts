import { CachedItemMeta } from "@/types/cache";

/**
 * Compute which cache items to evict to bring total size under limit.
 * Uses LRU strategy: evicts oldest-accessed first, covers before audio.
 */
export function computeEvictionPlan(
  items: Record<string, CachedItemMeta>,
  currentSizeBytes: number,
  maxSizeBytes: number,
): string[] {
  // 0 = unlimited
  if (maxSizeBytes === 0) return [];
  if (currentSizeBytes <= maxSizeBytes) return [];

  const entries = Object.entries(items).map(([key, meta]) => ({
    key,
    ...meta,
  }));

  // Sort by lastAccessedAt ascending (oldest first).
  // At the same access time, evict covers before audio (cheaper to re-fetch).
  entries.sort((a, b) => {
    if (a.lastAccessedAt === b.lastAccessedAt) {
      if (a.type === "cover" && b.type !== "cover") return -1;
      if (a.type !== "cover" && b.type === "cover") return 1;
      return 0;
    }
    return a.lastAccessedAt - b.lastAccessedAt;
  });

  const toEvict: string[] = [];
  let freed = 0;
  const target = currentSizeBytes - maxSizeBytes;

  for (const item of entries) {
    if (freed >= target) break;
    toEvict.push(item.key);
    freed += item.sizeBytes;
  }

  return toEvict;
}
