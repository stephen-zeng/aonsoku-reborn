import { Capacitor, registerPlugin, WebPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  NATIVE_AUDIO_PLUGIN_NAME,
  type NativeAudioEventName,
  type NativeAudioEvents,
  type NativeAudioLoadOptions,
  type NativeAudioMetadata,
  type NativeAudioPlugin,
  type NativeAudioQueueOptions,
  type NativeAudioRepeatModeOptions,
  type NativeAudioSeekOptions,
  type NativeAudioShuffleOptions,
  type NativeAudioSource,
} from "./types";

export type NativeAudioUnavailableReason =
  | "unsupported-platform"
  | "missing-plugin";

export type NativeAudioPluginAvailability =
  | {
      available: true;
      plugin: NativeAudioPlugin;
    }
  | {
      available: false;
      reason: NativeAudioUnavailableReason;
      message: string;
    };

export function createNativeAudioUnavailableError(method: string) {
  return new Error(
    `${NATIVE_AUDIO_PLUGIN_NAME}.${method} is only available in Capacitor iOS after the native plugin is installed.`,
  );
}

class UnavailableNativeAudioWeb
  extends WebPlugin
  implements NativeAudioPlugin
{
  load(_options: NativeAudioLoadOptions): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("load"));
  }

  play(): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("play"));
  }

  pause(): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("pause"));
  }

  stop(): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("stop"));
  }

  seek(_options: NativeAudioSeekOptions): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("seek"));
  }

  setRepeatMode(_options: NativeAudioRepeatModeOptions): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("setRepeatMode"));
  }

  setShuffle(_options: NativeAudioShuffleOptions): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("setShuffle"));
  }

  setQueue(_options: NativeAudioQueueOptions): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("setQueue"));
  }

  skipToNext(): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("skipToNext"));
  }

  skipToPrevious(): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("skipToPrevious"));
  }

  updateMetadata(_metadata: NativeAudioMetadata): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("updateMetadata"));
  }

  preload(_options: { source: NativeAudioSource }): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("preload"));
  }

  clear(): Promise<void> {
    return Promise.reject(createNativeAudioUnavailableError("clear"));
  }
}

export const AonsokuNativeAudio = registerPlugin<NativeAudioPlugin>(
  NATIVE_AUDIO_PLUGIN_NAME,
  {
    web: () => new UnavailableNativeAudioWeb(),
  },
);

export function getNativeAudioPluginAvailability(): NativeAudioPluginAvailability {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
    return {
      available: false,
      reason: "unsupported-platform",
      message: `${NATIVE_AUDIO_PLUGIN_NAME} is only supported in Capacitor iOS.`,
    };
  }

  if (!Capacitor.isPluginAvailable(NATIVE_AUDIO_PLUGIN_NAME)) {
    return {
      available: false,
      reason: "missing-plugin",
      message: `${NATIVE_AUDIO_PLUGIN_NAME} native plugin is not available.`,
    };
  }

  return {
    available: true,
    plugin: AonsokuNativeAudio,
  };
}

export function isNativeAudioPluginAvailable() {
  return getNativeAudioPluginAvailability().available;
}

export async function addNativeAudioListener<
  TEvent extends NativeAudioEventName,
>(
  eventName: TEvent,
  listener: (event: NativeAudioEvents[TEvent]) => void,
): Promise<PluginListenerHandle> {
  const availability = getNativeAudioPluginAvailability();
  if (!availability.available) {
    throw new Error(availability.message);
  }

  return availability.plugin.addListener(eventName, listener);
}

export async function tryAddNativeAudioListener<
  TEvent extends NativeAudioEventName,
>(
  eventName: TEvent,
  listener: (event: NativeAudioEvents[TEvent]) => void,
): Promise<PluginListenerHandle | null> {
  const availability = getNativeAudioPluginAvailability();
  if (!availability.available) return null;

  return availability.plugin.addListener(eventName, listener);
}
