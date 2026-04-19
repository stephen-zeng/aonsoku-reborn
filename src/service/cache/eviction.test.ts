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
  it("never evicts explicit audio, even over quota", () => {
    const items = {
      "audio/1": makeItem({ id: "1", source: "explicit", sizeBytes: 1000 }),
      "audio/2": makeItem({ id: "2", source: "explicit", sizeBytes: 1000 }),
    };
    expect(computeEvictionPlan(items, { assets: 0, audioLru: 100 })).toEqual(
      [],
    );
  });

  it("never evicts smart audio, even over quota", () => {
    const items = {
      "audio/1": makeItem({
        id: "1",
        source: "smart",
        sizeBytes: 5000,
        triggers: ["favorite"],
      }),
    };
    expect(computeEvictionPlan(items, { assets: 0, audioLru: 100 })).toEqual(
      [],
    );
  });

  it("LRU-evicts audio pool under its own quota", () => {
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
    // LRU pool total = 1200, quota = 500 → need to free 700.
    const plan = computeEvictionPlan(items, { assets: 0, audioLru: 500 });
    expect(plan).toEqual(["audio/lru-old", "audio/lru-mid"]);
  });

  it("evicts covers independently under assets quota regardless of source", () => {
    const items = {
      "cover/explicit": makeItem({
        id: "c-e",
        source: "explicit",
        type: "cover",
        sizeBytes: 400,
        lastAccessedAt: 10,
      }),
      "cover/lru": makeItem({
        id: "c-l",
        source: "lru",
        type: "cover",
        sizeBytes: 400,
        lastAccessedAt: 20,
      }),
    };
    // Assets pool total = 800, quota = 500. Oldest cover evicts first
    // even though it is tagged "explicit" — covers are cheap to re-fetch
    // and the assets pool ignores the source tag.
    const plan = computeEvictionPlan(items, { assets: 500, audioLru: 0 });
    expect(plan).toEqual(["cover/explicit"]);
  });

  it("applies both pools in the same pass", () => {
    const items = {
      "cover/a": makeItem({
        id: "ca",
        source: "lru",
        type: "cover",
        sizeBytes: 600,
        lastAccessedAt: 10,
      }),
      "cover/b": makeItem({
        id: "cb",
        source: "lru",
        type: "cover",
        sizeBytes: 200,
        lastAccessedAt: 20,
      }),
      "audio/x": makeItem({
        id: "ax",
        source: "lru",
        sizeBytes: 700,
        lastAccessedAt: 5,
      }),
      "audio/y": makeItem({
        id: "ay",
        source: "lru",
        sizeBytes: 300,
        lastAccessedAt: 15,
      }),
    };
    // Assets pool = 800, quota = 500 → free 300 from covers.
    // LRU pool = 1000, quota = 500 → free 500 from audio.
    const plan = computeEvictionPlan(items, { assets: 500, audioLru: 500 });
    expect(plan).toContain("cover/a");
    expect(plan).toContain("audio/x");
    expect(plan).not.toContain("cover/b");
    expect(plan).not.toContain("audio/y");
  });

  it("is a no-op when every pool is under quota", () => {
    const items = {
      "audio/1": makeItem({ id: "1", source: "lru", sizeBytes: 200 }),
      "cover/1": makeItem({
        id: "c1",
        source: "lru",
        type: "cover",
        sizeBytes: 200,
      }),
    };
    expect(
      computeEvictionPlan(items, { assets: 1000, audioLru: 1000 }),
    ).toEqual([]);
  });

  it("treats quota=0 as unlimited per pool", () => {
    const items = {
      "audio/big": makeItem({ id: "1", source: "lru", sizeBytes: 10_000_000 }),
      "cover/big": makeItem({
        id: "c1",
        source: "lru",
        type: "cover",
        sizeBytes: 10_000_000,
      }),
    };
    expect(computeEvictionPlan(items, { assets: 0, audioLru: 0 })).toEqual([]);
  });

  it("ignores non-LRU audio when sizing the LRU pool", () => {
    const items = {
      "audio/e": makeItem({ id: "e", source: "explicit", sizeBytes: 5000 }),
      "audio/s": makeItem({ id: "s", source: "smart", sizeBytes: 5000 }),
      "audio/lru-1": makeItem({ id: "l1", source: "lru", sizeBytes: 100 }),
      "audio/lru-2": makeItem({ id: "l2", source: "lru", sizeBytes: 100 }),
    };
    expect(computeEvictionPlan(items, { assets: 0, audioLru: 500 })).toEqual(
      [],
    );
  });
});
