import { describe, expect, it } from "vitest";
import type { CachedItemMeta } from "@/types/cache";
import { computeEvictionPlan } from "./eviction";

function makeItem(
  overrides: Partial<CachedItemMeta> & {
    id: string;
    source: CachedItemMeta["source"];
  },
): CachedItemMeta {
  return {
    type: "audio",
    sizeBytes: 100,
    cachedAt: 0,
    lastAccessedAt: 0,
    ...overrides,
  };
}

describe("computeEvictionPlan", () => {
  it("never evicts explicit items, even over quota", () => {
    const items = {
      "audio/1": makeItem({ id: "1", source: "explicit", sizeBytes: 1000 }),
      "audio/2": makeItem({ id: "2", source: "explicit", sizeBytes: 1000 }),
    };
    expect(computeEvictionPlan(items, { lru: 100 })).toEqual([]);
  });

  it("never evicts smart items, even over quota", () => {
    const items = {
      "audio/1": makeItem({
        id: "1",
        source: "smart",
        sizeBytes: 5000,
        triggers: ["favorite"],
      }),
    };
    expect(computeEvictionPlan(items, { lru: 100 })).toEqual([]);
  });

  it("only evicts LRU items to bring the LRU pool under quota", () => {
    const items = {
      "audio/explicit": makeItem({
        id: "explicit",
        source: "explicit",
        sizeBytes: 1000,
      }),
      "audio/smart": makeItem({
        id: "smart",
        source: "smart",
        sizeBytes: 1000,
      }),
      "audio/lru-old": makeItem({
        id: "lru-old",
        source: "lru",
        sizeBytes: 400,
        lastAccessedAt: 100,
      }),
      "audio/lru-mid": makeItem({
        id: "lru-mid",
        source: "lru",
        sizeBytes: 400,
        lastAccessedAt: 200,
      }),
      "audio/lru-new": makeItem({
        id: "lru-new",
        source: "lru",
        sizeBytes: 400,
        lastAccessedAt: 300,
      }),
    };
    // LRU pool total = 1200, quota = 500 → need to free 700 from the
    // oldest LRU entries (400 + 400 = 800 freed).
    const plan = computeEvictionPlan(items, { lru: 500 });
    expect(plan).toEqual(["audio/lru-old", "audio/lru-mid"]);
  });

  it("is a no-op when the LRU pool is under quota", () => {
    const items = {
      "audio/1": makeItem({ id: "1", source: "lru", sizeBytes: 200 }),
      "audio/2": makeItem({ id: "2", source: "lru", sizeBytes: 200 }),
    };
    expect(computeEvictionPlan(items, { lru: 1000 })).toEqual([]);
  });

  it("treats quota=0 as unlimited", () => {
    const items = {
      "audio/1": makeItem({ id: "1", source: "lru", sizeBytes: 10_000_000 }),
    };
    expect(computeEvictionPlan(items, { lru: 0 })).toEqual([]);
  });

  it("breaks LRU ties by evicting covers before audio", () => {
    const items = {
      "audio/song": makeItem({
        id: "song",
        source: "lru",
        type: "audio",
        sizeBytes: 600,
        lastAccessedAt: 100,
      }),
      "cover/art": makeItem({
        id: "art",
        source: "lru",
        type: "cover",
        sizeBytes: 600,
        lastAccessedAt: 100,
      }),
    };
    // LRU pool = 1200, quota = 700. Same lastAccessedAt, so tiebreak
    // evicts the cheaper cover first, which frees enough on its own.
    const plan = computeEvictionPlan(items, { lru: 700 });
    expect(plan).toEqual(["cover/art"]);
  });

  it("ignores explicit and smart entries when sizing the LRU pool", () => {
    const items = {
      // Together explicit + smart = 10_000 bytes but shouldn't count
      // toward the LRU pool size calculation.
      "audio/e": makeItem({ id: "e", source: "explicit", sizeBytes: 5000 }),
      "audio/s": makeItem({ id: "s", source: "smart", sizeBytes: 5000 }),
      // LRU pool total is only 200, well under quota.
      "audio/lru-1": makeItem({ id: "l1", source: "lru", sizeBytes: 100 }),
      "audio/lru-2": makeItem({ id: "l2", source: "lru", sizeBytes: 100 }),
    };
    expect(computeEvictionPlan(items, { lru: 500 })).toEqual([]);
  });
});
