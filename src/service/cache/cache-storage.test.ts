import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCache = new Map<string, Response>();

vi.stubGlobal("caches", {
  open: vi.fn(async () => ({
    put: vi.fn(async (url: string, response: Response) => {
      mockCache.set(url, response);
    }),
    match: vi.fn(async (url: string) => {
      const r = mockCache.get(url);
      return r ?? undefined;
    }),
    delete: vi.fn(async (url: string) => {
      return mockCache.delete(url);
    }),
    keys: vi.fn(async () => {
      return Array.from(mockCache.keys()).map(
        (k) => new Request(`http://localhost${k}`),
      );
    }),
  })),
  delete: vi.fn(async () => {
    mockCache.clear();
    return true;
  }),
});

import { cacheStorage } from "./cache-storage";

function putEncoded(key: string, data: Blob, contentType: string) {
  const response = new Response(data, {
    headers: {
      "Content-Type": contentType,
      "X-Cached-At": Date.now().toString(),
    },
  });
  const url = `/_cache/${encodeURIComponent(key)}`;
  mockCache.set(url, response);
}

function putLegacy(key: string, data: Blob, contentType: string) {
  const response = new Response(data, {
    headers: {
      "Content-Type": contentType,
      "X-Cached-At": Date.now().toString(),
    },
  });
  const url = `/_cache/${key}`;
  mockCache.set(url, response);
}

beforeEach(() => {
  mockCache.clear();
});

describe("cacheStorage", () => {
  it("round-trips a blob with put and get", async () => {
    const blob = new Blob(["hello world"], { type: "text/plain" });
    await cacheStorage.put("test-key", blob, "text/plain");

    const result = await cacheStorage.get("test-key");
    expect(result).not.toBeNull();
    const text = await result!.text();
    expect(text).toBe("hello world");
  });

  it("returns null for a missing key", async () => {
    const result = await cacheStorage.get("nonexistent");
    expect(result).toBeNull();
  });

  it("deletes an entry", async () => {
    const blob = new Blob(["data"], { type: "application/octet-stream" });
    await cacheStorage.put("del-key", blob, "application/octet-stream");
    expect(await cacheStorage.get("del-key")).not.toBeNull();

    const deleted = await cacheStorage.delete("del-key");
    expect(deleted).toBe(true);
    expect(await cacheStorage.get("del-key")).toBeNull();
  });

  it("returns false when deleting a nonexistent key", async () => {
    const deleted = await cacheStorage.delete("no-such-key");
    expect(deleted).toBe(false);
  });

  it("clears all entries", async () => {
    const blob = new Blob(["a"], { type: "text/plain" });
    await cacheStorage.put("key-a", blob, "text/plain");
    await cacheStorage.put("key-b", blob, "text/plain");

    await cacheStorage.clear();

    expect(await cacheStorage.get("key-a")).toBeNull();
    expect(await cacheStorage.get("key-b")).toBeNull();
  });

  it("has returns true for existing key", async () => {
    const blob = new Blob(["check"], { type: "text/plain" });
    await cacheStorage.put("check-key", blob, "text/plain");
    expect(await cacheStorage.has("check-key")).toBe(true);
  });

  it("has returns false for missing key", async () => {
    expect(await cacheStorage.has("no-such-key")).toBe(false);
  });

  it("keys returns all stored keys", async () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    await cacheStorage.put("alpha", blob, "text/plain");
    await cacheStorage.put("beta", blob, "text/plain");

    const keys = await cacheStorage.keys();
    expect(keys.sort()).toEqual(["alpha", "beta"]);
  });

  it("keys decodes percent-encoded URLs", async () => {
    const blob = new Blob(["x"], { type: "text/plain" });
    await cacheStorage.put("cover:al-123", blob, "text/plain");

    const keys = await cacheStorage.keys();
    expect(keys).toContain("cover:al-123");
  });

  it("replaces an existing entry with put", async () => {
    const blob1 = new Blob(["first"], { type: "text/plain" });
    const blob2 = new Blob(["second"], { type: "text/plain" });

    await cacheStorage.put("replace-key", blob1, "text/plain");
    await cacheStorage.put("replace-key", blob2, "text/plain");

    const result = await cacheStorage.get("replace-key");
    expect(await result!.text()).toBe("second");
  });

  it("handles keys with special characters via encoding", async () => {
    const blob = new Blob(["special"], { type: "text/plain" });
    await cacheStorage.put("cover:al-123", blob, "text/plain");

    const result = await cacheStorage.get("cover:al-123");
    expect(result).not.toBeNull();
    expect(await result!.text()).toBe("special");
  });

  it("falls back to legacy unencoded URL for get", async () => {
    const blob = new Blob(["legacy"], { type: "text/plain" });
    putLegacy("cover:al-123", blob, "text/plain");

    const result = await cacheStorage.get("cover:al-123");
    expect(result).not.toBeNull();
    expect(await result!.text()).toBe("legacy");
  });

  it("prefers encoded URL over legacy for get", async () => {
    const blobEncoded = new Blob(["encoded"], { type: "text/plain" });
    const blobLegacy = new Blob(["legacy"], { type: "text/plain" });
    putEncoded("cover:test", blobEncoded, "text/plain");
    putLegacy("cover:test", blobLegacy, "text/plain");

    const result = await cacheStorage.get("cover:test");
    expect(await result!.text()).toBe("encoded");
  });

  it("falls back to legacy unencoded URL for delete", async () => {
    const blob = new Blob(["legacy-del"], { type: "text/plain" });
    putLegacy("legacy-del-key", blob, "text/plain");

    const deleted = await cacheStorage.delete("legacy-del-key");
    expect(deleted).toBe(true);
  });

  it("has returns true for legacy unencoded key", async () => {
    const blob = new Blob(["legacy"], { type: "text/plain" });
    putLegacy("cover:al-123", blob, "text/plain");

    expect(await cacheStorage.has("cover:al-123")).toBe(true);
  });
});
