import { CachedItemMeta } from "@/types/cache";

/**
 * Per-source quota settings consumed by eviction. Only the LRU pool
 * is managed here — explicit downloads are untouchable by auto-eviction
 * and the smart pool is gated upstream by the smart-download engine
 * (it refuses to enqueue new items when its quota is full).
 *
 * A quota of `0` means unlimited for that pool.
 */
export interface EvictionQuotas {
  /** Byte cap on `source: "lru"` entries. */
  lru: number;
}

/**
 * Compute which cache items to evict to bring each pool under its
 * quota.
 *
 * Policy:
 *  - `explicit` — never evicted. User downloaded it on purpose and
 *    expects it to stay until they remove it.
 *  - `smart`    — not evicted here. The smart-download engine clears
 *    entries whose triggering rules no longer match and refuses to
 *    enqueue new items when its quota is full; runtime LRU pressure
 *    does not apply.
 *  - `lru`      — standard LRU by `lastAccessedAt` (oldest first).
 *    Cover-art entries break ties before audio because they're cheaper
 *    to re-fetch.
 */
export function computeEvictionPlan(
  items: Record<string, CachedItemMeta>,
  quotas: EvictionQuotas,
): string[] {
  return computeLruPoolEviction(items, quotas.lru);
}

function computeLruPoolEviction(
  items: Record<string, CachedItemMeta>,
  quota: number,
): string[] {
  if (quota === 0) return [];

  const lruEntries: { key: string; meta: CachedItemMeta }[] = [];
  let currentSize = 0;
  for (const [key, meta] of Object.entries(items)) {
    if (meta.source !== "lru") continue;
    lruEntries.push({ key, meta });
    currentSize += meta.sizeBytes;
  }

  if (currentSize <= quota) return [];

  lruEntries.sort((a, b) => {
    if (a.meta.lastAccessedAt === b.meta.lastAccessedAt) {
      if (a.meta.type === "cover" && b.meta.type !== "cover") return -1;
      if (a.meta.type !== "cover" && b.meta.type === "cover") return 1;
      return 0;
    }
    return a.meta.lastAccessedAt - b.meta.lastAccessedAt;
  });

  const toEvict: string[] = [];
  let freed = 0;
  const target = currentSize - quota;

  for (const { key, meta } of lruEntries) {
    if (freed >= target) break;
    toEvict.push(key);
    freed += meta.sizeBytes;
  }

  return toEvict;
}
