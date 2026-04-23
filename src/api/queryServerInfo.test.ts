import { afterEach, describe, expect, it, vi } from "vitest";
import { queryServerInfo } from "./queryServerInfo";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("queryServerInfo", () => {
  it("returns server info on success", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          "subsonic-response": {
            version: "1.16.1",
            type: "navidrome",
          },
        }),
    });

    const result = await queryServerInfo("https://example.com");
    expect(result.protocolVersion).toBe("1.16.1");
    expect(result.serverType).toBe("navidrome");
    expect(result.protocolVersionNumber).toBe(1161);
  });

  it("returns defaults on fetch error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const result = await queryServerInfo("https://example.com");
    expect(result.protocolVersion).toBe("1.16.0");
    expect(result.protocolVersionNumber).toBe(1160);
    expect(result.serverType).toBe("subsonic");
  });

  it("lowercases the server type", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          "subsonic-response": {
            version: "1.16.1",
            type: "Navidrome",
          },
        }),
    });

    const result = await queryServerInfo("https://example.com");
    expect(result.serverType).toBe("navidrome");
  });

  it("defaults server type to subsonic when type is empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          "subsonic-response": {
            version: "1.16.1",
            type: "",
          },
        }),
    });

    const result = await queryServerInfo("https://example.com");
    expect(result.serverType).toBe("subsonic");
  });
});