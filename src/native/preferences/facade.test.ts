import { Capacitor } from "@capacitor/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isNativePreferencesAvailable } from "./facade";

const mocks = vi.hoisted(() => ({
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

vi.mock("@aonsoku/capacitor-native/preferences", () => ({
  AonsokuNativePreferences: {},
  NATIVE_PREFERENCES_PLUGIN_NAME: "AonsokuNativePreferences",
}));

const mockIsNativePlatform = vi.mocked(Capacitor.isNativePlatform);
const mockGetPlatform = vi.mocked(Capacitor.getPlatform);
const mockIsPluginAvailable = vi.mocked(Capacitor.isPluginAvailable);

describe("native preferences facade", () => {
  beforeEach(() => {
    mockIsNativePlatform.mockReset();
    mockGetPlatform.mockReset();
    mockIsPluginAvailable.mockReset();
    mockIsNativePlatform.mockReturnValue(false);
    mockGetPlatform.mockReturnValue("web");
    mockIsPluginAvailable.mockReturnValue(false);
  });

  it("requires a native platform", () => {
    expect(isNativePreferencesAvailable()).toBe(false);
    expect(mockIsPluginAvailable).not.toHaveBeenCalled();
  });

  it.each(["ios", "android"])(
    "is available on supported %s platforms",
    (platform) => {
      mockIsNativePlatform.mockReturnValue(true);
      mockGetPlatform.mockReturnValue(platform);
      mockIsPluginAvailable.mockReturnValue(true);

      expect(isNativePreferencesAvailable()).toBe(true);
      expect(mockIsPluginAvailable).toHaveBeenCalledWith(
        "AonsokuNativePreferences",
      );
    },
  );

  it("keeps unsupported native platforms unavailable", () => {
    mockIsNativePlatform.mockReturnValue(true);
    mockGetPlatform.mockReturnValue("electron");
    mockIsPluginAvailable.mockReturnValue(true);

    expect(isNativePreferencesAvailable()).toBe(false);
  });
});
