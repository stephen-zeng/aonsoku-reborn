import { Capacitor } from "@capacitor/core";
import { hasElectronBridge, hasTauriBridge, isDesktop } from "./desktop";
import { isIOS } from "./platform";

export type PlatformRuntime =
  | "web"
  | "electron"
  | "tauri"
  | "capacitor-ios"
  | "capacitor-android";

export interface PlaybackCapabilities {
  canSetVolume: boolean;
  requiresSystemVolume: boolean;
  supportsSystemVolumeControl: boolean;
  supportsWebAudioReplayGain: boolean;
  supportsNativePlayback: boolean;
  supportsBackgroundPlayback: boolean;
}

const runtimeCapabilities: Record<PlatformRuntime, PlaybackCapabilities> = {
  electron: {
    canSetVolume: true,
    requiresSystemVolume: false,
    supportsSystemVolumeControl: false,
    supportsWebAudioReplayGain: true,
    supportsNativePlayback: false,
    supportsBackgroundPlayback: true,
  },
  tauri: {
    canSetVolume: true,
    requiresSystemVolume: false,
    supportsSystemVolumeControl: false,
    supportsWebAudioReplayGain: true,
    supportsNativePlayback: false,
    supportsBackgroundPlayback: true,
  },
  "capacitor-ios": {
    canSetVolume: false,
    requiresSystemVolume: true,
    supportsSystemVolumeControl: true,
    supportsWebAudioReplayGain: false,
    supportsNativePlayback: true,
    supportsBackgroundPlayback: true,
  },
  "capacitor-android": {
    canSetVolume: true,
    requiresSystemVolume: true,
    supportsSystemVolumeControl: true,
    supportsWebAudioReplayGain: false,
    supportsNativePlayback: true,
    supportsBackgroundPlayback: true,
  },
  web: {
    canSetVolume: true,
    requiresSystemVolume: false,
    supportsSystemVolumeControl: false,
    supportsWebAudioReplayGain: true,
    supportsNativePlayback: false,
    supportsBackgroundPlayback: false,
  },
};

export function detectRuntime(): PlatformRuntime {
  if (hasTauriBridge()) {
    return "tauri";
  }

  if (isDesktop()) {
    return "electron";
  }

  if (!Capacitor.isNativePlatform()) {
    return "web";
  }

  const platform = Capacitor.getPlatform();
  if (platform === "ios") {
    return "capacitor-ios";
  }
  if (platform === "android") {
    return "capacitor-android";
  }

  return "web";
}

let cachedRuntime: PlatformRuntime | null = null;

export function getRuntime(): PlatformRuntime {
  if (cachedRuntime === null) {
    cachedRuntime = detectRuntime();
  }
  return cachedRuntime;
}

export function resetRuntimeCache(): void {
  cachedRuntime = null;
}

export function getPlaybackCapabilities(): PlaybackCapabilities {
  const runtime = getRuntime();
  const capabilities = runtimeCapabilities[runtime];

  if (runtime === "web" && isIOS()) {
    return {
      ...capabilities,
      canSetVolume: false,
      requiresSystemVolume: true,
    };
  }

  return capabilities;
}

export interface DesktopCapabilities {
  hasDesktopIntegration: boolean;
  hasLanControl: boolean;
  hasMiniPlayer: boolean;
  hasNativeThemeSync: boolean;
  hasUpdateCheck: boolean;
}

export function getDesktopCapabilities(): DesktopCapabilities {
  const hasElectron = hasElectronBridge();
  const hasTauri = hasTauriBridge();
  return {
    hasDesktopIntegration: hasElectron || hasTauri,
    hasLanControl:
      hasElectron &&
      typeof window !== "undefined" &&
      typeof window.api?.lanControl !== "undefined",
    hasMiniPlayer:
      hasElectron ||
      (typeof window !== "undefined" && "documentPictureInPicture" in window),
    hasNativeThemeSync: hasElectron,
    hasUpdateCheck: hasElectron,
  };
}
