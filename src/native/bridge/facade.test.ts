import { Capacitor } from "@capacitor/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNativeBridgeAvailability, isNativeBridgeAvailable } from "./facade";

const mocks = vi.hoisted(() => ({
  plugin: {},
  mockIsNativePlatform: vi.fn(),
  mockGetPlatform: vi.fn(),
  mockIsPluginAvailable: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: mocks.mockIsNativePlatform,
    getPlatform: mocks.mockGetPlatform,
    isPluginAvailable: mocks.mockIsPluginAvailable,
  },
}));

vi.mock("@aonsoku/capacitor-native/bridge", () => ({
  AonsokuNativeBridge: mocks.plugin,
  NATIVE_BRIDGE_PLUGIN_NAME: "AonsokuNativeBridge",
}));

const mockIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockGetPlatform = vi.mocked(Capacitor.getPlatform);
const mockIsPluginAvailable = vi.mocked(Capacitor.isPluginAvailable);

describe("native bridge facade", () => {
  beforeEach(() => {
    mockIsNativePlatform.mockReset();
    mockGetPlatform.mockReset();
    mockIsPluginAvailable.mockReset();
    mockIsNativePlatform.mockReturnValue(false);
    mockGetPlatform.mockReturnValue("web");
    mockIsPluginAvailable.mockReturnValue(false);
  });

  it("reports web as unavailable", () => {
    expect(getNativeBridgeAvailability()).toMatchObject({
      available: false,
      reason: "Only supported on native Capacitor platforms",
    });
    expect(isNativeBridgeAvailable()).toBe(false);
  });

  it.each(["ios", "android"])(
    "returns the plugin on supported %s platforms",
    (platform) => {
      mockIsNativePlatform.mockReturnValue(true);
      mockGetPlatform.mockReturnValue(platform);
      mockIsPluginAvailable.mockReturnValue(true);

      expect(getNativeBridgeAvailability()).toEqual({
        available: true,
        plugin: mocks.plugin,
      });
      expect(isNativeBridgeAvailable()).toBe(true);
      expect(mockIsPluginAvailable).toHaveBeenCalledWith("AonsokuNativeBridge");
    },
  );

  it("keeps unsupported native platforms unavailable", () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockGetPlatform.mockReturnValue("electron");

    expect(getNativeBridgeAvailability()).toMatchObject({
      available: false,
      reason: "Unsupported native platform: electron",
    });
  });
});
