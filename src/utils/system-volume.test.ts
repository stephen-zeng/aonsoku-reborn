import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mockGetPlaybackCapabilities: vi.fn(),
  mockGetNativeAudioPluginAvailability: vi.fn(),
  mockSetSystemVolume: vi.fn(),
  mockGetSystemVolume: vi.fn(),
}));

vi.mock("@/utils/capabilities", () => ({
  getPlaybackCapabilities: mocks.mockGetPlaybackCapabilities,
}));

vi.mock("@/native/audio/facade", () => ({
  getNativeAudioPluginAvailability: mocks.mockGetNativeAudioPluginAvailability,
}));

import {
  canUseSystemVolumeControl,
  clampVolume,
  getCurrentSystemVolume,
  getSystemVolume,
  setCurrentSystemVolume,
  setSystemVolume,
  volumeFromNative,
} from "@/utils/system-volume";

beforeEach(() => {
  vi.resetAllMocks();
  setCurrentSystemVolume(100);
});

describe("clampVolume", () => {
  it("clamps to 0-100 range", () => {
    expect(clampVolume(-10)).toBe(0);
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(50)).toBe(50);
    expect(clampVolume(100)).toBe(100);
    expect(clampVolume(150)).toBe(100);
  });

  it("rounds to integer", () => {
    expect(clampVolume(50.5)).toBe(51);
    expect(clampVolume(50.4)).toBe(50);
  });

  it("returns 100 for non-finite values", () => {
    expect(clampVolume(Number.NaN)).toBe(100);
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(100);
    expect(clampVolume(Number.NEGATIVE_INFINITY)).toBe(100);
  });
});

describe("volumeFromNative", () => {
  it("converts 0-1 native value to 0-100 UI value", () => {
    expect(volumeFromNative(0)).toBe(0);
    expect(volumeFromNative(0.5)).toBe(50);
    expect(volumeFromNative(1)).toBe(100);
    expect(volumeFromNative(0.255)).toBe(26);
  });

  it("clamps out-of-range values", () => {
    expect(volumeFromNative(-0.1)).toBe(0);
    expect(volumeFromNative(1.5)).toBe(100);
  });
});

describe("canUseSystemVolumeControl", () => {
  it("returns false when supportsSystemVolumeControl is false", () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: false,
  });
  expect(canUseSystemVolumeControl()).toBe(false);
});

it("returns false when plugin is unavailable", () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: true,
  });
  mocks.mockGetNativeAudioPluginAvailability.mockReturnValue({
    available: false,
  });
  expect(canUseSystemVolumeControl()).toBe(false);
});

it("returns true when both capability and plugin are available", () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: true,
  });
  mocks.mockGetNativeAudioPluginAvailability.mockReturnValue({
    available: true,
    plugin: {},
  });
  expect(canUseSystemVolumeControl()).toBe(true);
});
});

describe("getCurrentSystemVolume", () => {
  it("returns initial value", () => {
    expect(getCurrentSystemVolume()).toBe(100);
  });

  it("returns updated value after setCurrentSystemVolume", () => {
    setCurrentSystemVolume(50);
    expect(getCurrentSystemVolume()).toBe(50);
  });
});

describe("setSystemVolume", () => {
  it("calls native plugin with clamped 0-1 value", async () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: true,
  });
  mocks.mockGetNativeAudioPluginAvailability.mockReturnValue({
    available: true,
    plugin: { setSystemVolume: mocks.mockSetSystemVolume },
  });
  mocks.mockSetSystemVolume.mockResolvedValue(undefined);

  await setSystemVolume(50);

  expect(mocks.mockSetSystemVolume).toHaveBeenCalledWith({ value: 0.5 });
  expect(getCurrentSystemVolume()).toBe(50);
});

it("updates currentSystemVolume on success", async () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: true,
  });
  mocks.mockGetNativeAudioPluginAvailability.mockReturnValue({
    available: true,
    plugin: { setSystemVolume: mocks.mockSetSystemVolume },
  });
  mocks.mockSetSystemVolume.mockResolvedValue(undefined);

  setCurrentSystemVolume(80);
  await setSystemVolume(30);

  expect(getCurrentSystemVolume()).toBe(30);
});

it("does nothing when system volume control is unavailable", async () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: false,
  });

  await setSystemVolume(50);

  expect(mocks.mockSetSystemVolume).not.toHaveBeenCalled();
  expect(getCurrentSystemVolume()).toBe(100);
  });
});

describe("getSystemVolume", () => {
  it("returns native value converted to 0-100", async () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: true,
  });
  mocks.mockGetNativeAudioPluginAvailability.mockReturnValue({
    available: true,
    plugin: { getSystemVolume: mocks.mockGetSystemVolume },
  });
  mocks.mockGetSystemVolume.mockResolvedValue({ volume: 0.75 });

  const result = await getSystemVolume();

  expect(result).toBe(75);
  expect(getCurrentSystemVolume()).toBe(75);
});

it("returns 100 when system volume control is unavailable", async () => {
  mocks.mockGetPlaybackCapabilities.mockReturnValue({
    supportsSystemVolumeControl: false,
  });

  const result = await getSystemVolume();

  expect(result).toBe(100);
  expect(mocks.mockGetSystemVolume).not.toHaveBeenCalled();
  });
});
