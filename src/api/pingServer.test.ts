import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthType } from "@/types/serverConfig";
import { pingServer, probeServerConnection } from "./pingServer";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch(response: {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    json: response.json ?? (() => Promise.resolve({})),
  });
}

describe("pingServer", () => {
  it("returns true when server responds ok", async () => {
    mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          "subsonic-response": { status: "ok", version: "1.16.1" },
        }),
    });
    const result = await pingServer(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result).toBe(true);
  });

  it("returns false when server responds failed", async () => {
    mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          "subsonic-response": {
            status: "failed",
            error: { code: 40 },
          },
        }),
    });
    const result = await pingServer(
      "https://example.com",
      "admin",
      "wrong",
      AuthType.TOKEN,
    );
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError("Network error"));
    const result = await pingServer(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result).toBe(false);
  });

  it("returns false on HTTP 401", async () => {
    mockFetch({ ok: false, status: 401 });
    const result = await pingServer(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result).toBe(false);
  });

  it("returns false on HTTP 403", async () => {
    mockFetch({ ok: false, status: 403 });
    const result = await pingServer(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result).toBe(false);
  });

  it("returns false on other HTTP errors", async () => {
    mockFetch({ ok: false, status: 500 });
    const result = await pingServer(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result).toBe(false);
  });
});

describe("probeServerConnection", () => {
  it("returns ok status and protocol version on success", async () => {
    mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          "subsonic-response": { status: "ok", version: "1.16.1" },
        }),
    });
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("ok");
    expect(result.protocolVersion).toBe("1.16.1");
  });

  it("returns auth_failed for error code 40", async () => {
    mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          "subsonic-response": {
            status: "failed",
            error: { code: 40 },
          },
        }),
    });
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "wrong",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("auth_failed");
  });

  it("returns auth_failed for error code 41", async () => {
    mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          "subsonic-response": {
            status: "failed",
            error: { code: 41 },
          },
        }),
    });
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "wrong",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("auth_failed");
  });

  it("returns network_unreachable on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fail"));
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("network_unreachable");
  });

  it("returns server_error when response has no subsonic-response", async () => {
    mockFetch({
      ok: true,
      json: () => Promise.resolve({}),
    });
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("server_error");
  });

  it("retries with protocol version on error code 30", async () => {
    const callArgs: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      callArgs.push(url);
      if (callArgs.length === 1) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              "subsonic-response": {
                status: "failed",
                error: { code: 30 },
                version: "1.15.0",
              },
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            "subsonic-response": { status: "ok", version: "1.15.0" },
          }),
      });
    });

    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("ok");
    expect(result.protocolVersion).toBe("1.15.0");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("returns server_error for unknown failed status", async () => {
    mockFetch({
      ok: true,
      json: () =>
        Promise.resolve({
          "subsonic-response": {
            status: "failed",
            error: { code: 99 },
          },
        }),
    });
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("server_error");
  });

  it("returns auth_failed for HTTP 401", async () => {
    mockFetch({ ok: false, status: 401 });
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("auth_failed");
  });

  it("returns server_error for HTTP 500", async () => {
    mockFetch({ ok: false, status: 500 });
    const result = await probeServerConnection(
      "https://example.com",
      "admin",
      "pass",
      AuthType.TOKEN,
    );
    expect(result.status).toBe("server_error");
  });
});
