export enum Platform {
  Web = "web",
  Electron = "electron",
  CapacitorIOS = "capacitor-ios",
  CapacitorAndroid = "capacitor-android",
}

export interface PlatformCapabilities {
  supportsNativeAudio: boolean;
  supportsNativeCache: boolean;
  supportsWebAudioAPI: boolean;
  supportsMediaSession: boolean;
  supportsPictureInPicture: boolean;
}
