import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// biome-ignore lint/suspicious/noExplicitAny: test helper needs to manipulate global window
const g = globalThis as any;

function setCapacitor(platform: string) {
  g.window = g.window ?? {};
  g.window.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => platform,
  };
}

function clearCapacitor() {
  if (g.window?.Capacitor) {
    delete g.window.Capacitor;
  }
}

describe("platform detection", () => {
  beforeEach(() => {
    vi.resetModules();
    clearCapacitor();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCapacitor();
  });

  it("detects web platform when no Capacitor or Electron", async () => {
    vi.doMock("react-device-detect", () => ({ isElectron: false }));
    const { getPlatform, Platform } = await import("./index");
    expect(getPlatform()).toBe(Platform.Web);
  });

  it("detects Electron platform", async () => {
    vi.doMock("react-device-detect", () => ({ isElectron: true }));
    const { getPlatform, Platform } = await import("./index");
    expect(getPlatform()).toBe(Platform.Electron);
  });

  it("detects Capacitor iOS", async () => {
    vi.doMock("react-device-detect", () => ({ isElectron: false }));
    setCapacitor("ios");
    const { getPlatform, Platform } = await import("./index");
    expect(getPlatform()).toBe(Platform.CapacitorIOS);
  });

  it("detects Capacitor Android", async () => {
    vi.doMock("react-device-detect", () => ({ isElectron: false }));
    setCapacitor("android");
    const { getPlatform, Platform } = await import("./index");
    expect(getPlatform()).toBe(Platform.CapacitorAndroid);
  });

  it("isCapacitorNative returns true for iOS and Android", async () => {
    vi.doMock("react-device-detect", () => ({ isElectron: false }));
    setCapacitor("ios");
    const { isCapacitorNative } = await import("./index");
    expect(isCapacitorNative()).toBe(true);
  });

  it("getCapabilities returns native flags for Capacitor", async () => {
    vi.doMock("react-device-detect", () => ({ isElectron: false }));
    setCapacitor("ios");
    const { getCapabilities } = await import("./index");
    const caps = getCapabilities();
    expect(caps.supportsNativeAudio).toBe(true);
    expect(caps.supportsNativeCache).toBe(true);
    expect(caps.supportsWebAudioAPI).toBe(false);
  });

  it("getCapabilities returns web flags for browser", async () => {
    vi.doMock("react-device-detect", () => ({ isElectron: false }));
    const { getCapabilities } = await import("./index");
    const caps = getCapabilities();
    expect(caps.supportsNativeAudio).toBe(false);
    expect(caps.supportsNativeCache).toBe(false);
    expect(caps.supportsWebAudioAPI).toBe(true);
  });
});
