import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetLibraryDbForTests, libraryDb } from "@/store/library-db";
import {
  bulkDeleteCacheMeta,
  deleteCacheMeta,
  persistCacheMeta,
} from "./persist-meta";

beforeEach(async () => {
  await _resetLibraryDbForTests();
});

describe("persistCacheMeta", () => {
  it("persists a cache meta entry", async () => {
    const meta = {
      key: "audio:test-1",
      id: "test-1",
      type: "audio" as const,
      source: "lru" as const,
      sizeBytes: 1024,
      cachedAt: 100,
      lastAccessedAt: 200,
    };
    await persistCacheMeta("audio:test-1", meta);
    const fetched = await libraryDb.cacheMeta.get("audio:test-1");
    expect(fetched).toBeDefined();
    expect(fetched?.id).toBe("test-1");
  });

  it("retries on failure", async () => {
    const putSpy = vi.spyOn(libraryDb.cacheMeta, "put");
    let callCount = 0;
    putSpy.mockImplementation(async () => {
      callCount++;
      if (callCount <= 1) throw new Error("DB locked");
      return undefined;
    });

    const meta = {
      key: "audio:retry",
      id: "retry",
      type: "audio" as const,
      source: "lru" as const,
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    };
    await persistCacheMeta("audio:retry", meta);
    expect(callCount).toBe(2);
    putSpy.mockRestore();
  });
});

describe("deleteCacheMeta", () => {
  it("deletes a cache meta entry", async () => {
    const meta = {
      key: "audio:del-1",
      id: "del-1",
      type: "audio" as const,
      source: "lru" as const,
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    };
    await libraryDb.cacheMeta.put(meta);
    await deleteCacheMeta("audio:del-1");
    const fetched = await libraryDb.cacheMeta.get("audio:del-1");
    expect(fetched).toBeUndefined();
  });

  it("does not throw when deleting non-existent key", async () => {
    await expect(deleteCacheMeta("audio:not-exist")).resolves.toBeUndefined();
  });
});

describe("bulkDeleteCacheMeta", () => {
  it("deletes multiple entries", async () => {
    const items = [
      {
        key: "audio:b1",
        id: "b1",
        type: "audio" as const,
        source: "lru" as const,
        sizeBytes: 100,
        cachedAt: 1,
        lastAccessedAt: 1,
      },
      {
        key: "audio:b2",
        id: "b2",
        type: "audio" as const,
        source: "lru" as const,
        sizeBytes: 200,
        cachedAt: 2,
        lastAccessedAt: 2,
      },
    ];
    await libraryDb.cacheMeta.bulkPut(items);
    await bulkDeleteCacheMeta(["audio:b1", "audio:b2"]);
    expect(await libraryDb.cacheMeta.get("audio:b1")).toBeUndefined();
    expect(await libraryDb.cacheMeta.get("audio:b2")).toBeUndefined();
  });

  it("is a no-op for empty keys array", async () => {
    await expect(bulkDeleteCacheMeta([])).resolves.toBeUndefined();
  });
});
