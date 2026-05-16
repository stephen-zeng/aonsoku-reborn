import { isElectron } from "react-device-detect";
import { Platform, PlatformCapabilities } from "./types";

let cachedPlatform: Platform | null = null;

function detectCapacitor(): {
  isNative: boolean;
  platform: string | undefined;
} {
  if (typeof window === "undefined") {
    return { isNative: false, platform: undefined };
  }
  const capacitor = (
    window as unknown as { Capacitor?: CapacitorGlobal }
  ).Capacitor;
  if (!capacitor || !capacitor.isNativePlatform?.()) {
    return { isNative: false, platform: undefined };
  }
  return { isNative: true, platform: capacitor.getPlatform?.() };
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

export function getPlatform(): Platform {
  if (cachedPlatform) return cachedPlatform;

  const cap = detectCapacitor();
  if (cap.isNative) {
    cachedPlatform =
      cap.platform === "android"
        ? Platform.CapacitorAndroid
        : Platform.CapacitorIOS;
  } else if (isElectron) {
    cachedPlatform = Platform.Electron;
  } else {
    cachedPlatform = Platform.Web;
  }

  return cachedPlatform;
}

export function isCapacitorNative(): boolean {
  const p = getPlatform();
  return p === Platform.CapacitorIOS || p === Platform.CapacitorAndroid;
}

export function isCapacitorIOS(): boolean {
  return getPlatform() === Platform.CapacitorIOS;
}

export function isCapacitorAndroid(): boolean {
  return getPlatform() === Platform.CapacitorAndroid;
}

export function getCapabilities(): PlatformCapabilities {
  const platform = getPlatform();

  switch (platform) {
    case Platform.CapacitorIOS:
    case Platform.CapacitorAndroid:
      return {
        supportsNativeAudio: true,
        supportsNativeCache: true,
        supportsWebAudioAPI: false,
        supportsMediaSession: false,
        supportsPictureInPicture: false,
      };
    case Platform.Electron:
    case Platform.Web:
      return {
        supportsNativeAudio: false,
        supportsNativeCache: false,
        supportsWebAudioAPI: true,
        supportsMediaSession:
          typeof navigator !== "undefined" && "mediaSession" in navigator,
        supportsPictureInPicture:
          typeof window !== "undefined" &&
          "documentPictureInPicture" in window,
      };
  }
}

export { Platform, type PlatformCapabilities } from "./types";
