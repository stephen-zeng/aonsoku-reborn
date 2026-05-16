import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCache = new Map<string, Response>();

vi.stubGlobal("caches", {
  open: vi.fn(async () => ({
    put: vi.fn(async (url: string, response: Response) => {
      mockCache.set(url, response);
    }),
    match: vi.fn(async (url: string) => mockCache.get(url) ?? undefined),
    delete: vi.fn(async (url: string) => mockCache.delete(url)),
    keys: vi.fn(async () =>
      Array.from(mockCache.keys()).map(
        (k) => new Request(`http://localhost${k}`),
      ),
    ),
  })),
  delete: vi.fn(async () => {
    mockCache.clear();
    return true;
  }),
});

import { WebCacheBackend } from "./web-cache-backend";

beforeEach(() => {
  mockCache.clear();
});

describe("WebCacheBackend", () => {
  it("implements CacheBackend interface via delegation", async () => {
    const backend = new WebCacheBackend();

    const blob = new Blob(["test"], { type: "audio/mpeg" });
    await backend.put("song-1", blob, "audio/mpeg");

    expect(await backend.has("song-1")).toBe(true);
    const result = await backend.get("song-1");
    expect(result).not.toBeNull();
    expect(await result!.text()).toBe("test");

    const keys = await backend.keys();
    expect(keys).toContain("song-1");

    await backend.delete("song-1");
    expect(await backend.has("song-1")).toBe(false);
  });

  it("clear removes all entries", async () => {
    const backend = new WebCacheBackend();
    const blob = new Blob(["x"], { type: "audio/mpeg" });
    await backend.put("a", blob, "audio/mpeg");
    await backend.put("b", blob, "audio/mpeg");

    await backend.clear();
    expect(await backend.has("a")).toBe(false);
    expect(await backend.has("b")).toBe(false);
  });
});
