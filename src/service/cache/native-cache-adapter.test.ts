import { describe, expect, it, vi, afterEach } from "vitest";
import {
  FakeNativeCacheAdapter,
} from "./contracts/fakes";
import type { NativeCacheAdapter } from "./contracts";
import {
  _resetNativeCacheAdapter,
  _setNativeCacheAdapterForTests,
  getNativeCacheAdapter,
} from "./native-cache-adapter";

vi.mock("@/utils/capabilities", () => ({
  getRuntime: vi.fn(),
}));

import { getRuntime } from "@/utils/capabilities";

afterEach(() => {
  _resetNativeCacheAdapter();
  vi.restoreAllMocks();
});

describe("getNativeCacheAdapter", () => {
  it("returns a null adapter on web platform", () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const adapter = getNativeCacheAdapter();

    expect(adapter).toBeDefined();
  });

  it("web null adapter returns null for resolve", async () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const adapter = getNativeCacheAdapter();

    expect(await adapter.resolveAudioFile("song-1")).toBeNull();
  });

  it("web null adapter returns null for size", async () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const adapter = getNativeCacheAdapter();

    expect(await adapter.getAudioFileSize("song-1")).toBeNull();
  });

  it("web null adapter returns false for delete", async () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const adapter = getNativeCacheAdapter();

    expect(await adapter.deleteAudioFile("song-1")).toBe(false);
  });

  it("web null adapter returns false for evict", async () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const adapter = getNativeCacheAdapter();

    expect(await adapter.evictAudioFile("song-1")).toBe(false);
  });

  it("web null adapter throws on store", async () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const adapter = getNativeCacheAdapter();

    await expect(
      adapter.storeAudioFile("song-1", new Blob(["x"]), "audio/mpeg"),
    ).rejects.toThrow("NativeCacheAdapter is not available on web platform");
  });

  it("throws on capacitor-ios (not yet implemented)", () => {
    vi.mocked(getRuntime).mockReturnValue("capacitor-ios");

    expect(() => getNativeCacheAdapter()).toThrow(
      "Capacitor iOS native cache adapter has not been implemented yet",
    );
  });

  it("throws on capacitor-android (not yet available)", () => {
    vi.mocked(getRuntime).mockReturnValue("capacitor-android");

    expect(() => getNativeCacheAdapter()).toThrow(
      "Capacitor Android native cache adapter is not available until Phase 5",
    );
  });

  it("caches the adapter instance", () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const a = getNativeCacheAdapter();
    const b = getNativeCacheAdapter();
    expect(a).toBe(b);
  });

  it("reset clears the cached adapter", () => {
    vi.mocked(getRuntime).mockReturnValue("web");
    const a = getNativeCacheAdapter();
    _resetNativeCacheAdapter();
    const b = getNativeCacheAdapter();
    expect(a).not.toBe(b);
  });

  it("allows injecting a test adapter", () => {
    const fake: NativeCacheAdapter = new FakeNativeCacheAdapter();
    _setNativeCacheAdapterForTests(fake);
    const adapter = getNativeCacheAdapter();
    expect(adapter).toBe(fake);
  });
});