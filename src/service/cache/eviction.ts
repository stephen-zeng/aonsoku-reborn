import { CachedItemMeta } from "@/types/cache";

/**
 * Per-pool quotas consumed by eviction.
 *
 *  - `assets`   — applies to every `type: "cover"` entry regardless of
 *    source. Covers are cheap to re-fetch, so the L2 pool always
 *    LRU-evicts under its own cap rather than riding on audio quotas.
 *  - `audioLru` — applies to `type: "audio" && source: "lru"` entries
 *    (playback auto-cache + queue prefetch).
 *
 * Explicit downloads are never evicted here; smart-pool items are gated
 * upstream by the smart-download engine (it refuses to enqueue more
 * when its quota is full). Both pools' sizes are reported from the
 * cache index but not acted on by this module.
 *
 * A quota of `0` means unlimited for that pool.
 */
export interface EvictionQuotas {
  assets: number;
  audioLru: number;
}

interface EvictionPool {
  name: string;
  quota: number;
  matches: (meta: CachedItemMeta) => boolean;
}

/**
 * Compute which cache keys to evict to bring each pool back under its
 * quota. Pools are evaluated independently; a pool under quota
 * contributes nothing.
 */
export function computeEvictionPlan(
  items: Record<string, CachedItemMeta>,
  quotas: EvictionQuotas,
): string[] {
  const pools: EvictionPool[] = [
    {
      name: "assets",
      quota: quotas.assets,
      matches: (m) => m.type === "cover",
    },
    {
      name: "audioLru",
      quota: quotas.audioLru,
      matches: (m) => m.type === "audio" && m.source === "lru",
    },
  ];

  const plan: string[] = [];
  for (const pool of pools) {
    plan.push(...lruEvict(items, pool));
  }
  return plan;
}

function lruEvict(
  items: Record<string, CachedItemMeta>,
  pool: EvictionPool,
): string[] {
  if (pool.quota === 0) return [];

  const entries: { key: string; meta: CachedItemMeta }[] = [];
  let currentSize = 0;
  for (const [key, meta] of Object.entries(items)) {
    if (!pool.matches(meta)) continue;
    entries.push({ key, meta });
    currentSize += meta.sizeBytes;
  }

  if (currentSize <= pool.quota) return [];

  entries.sort((a, b) => {
    if (a.meta.lastAccessedAt === b.meta.lastAccessedAt) {
      if (a.meta.type === "cover" && b.meta.type !== "cover") return -1;
      if (a.meta.type !== "cover" && b.meta.type === "cover") return 1;
      return 0;
    }
    return a.meta.lastAccessedAt - b.meta.lastAccessedAt;
  });

  const toEvict: string[] = [];
  let freed = 0;
  const target = currentSize - pool.quota;

  for (const { key, meta } of entries) {
    if (freed >= target) break;
    toEvict.push(key);
    freed += meta.sizeBytes;
  }

  return toEvict;
}
