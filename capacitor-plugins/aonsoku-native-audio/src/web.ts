import { WebPlugin } from "@capacitor/core";
import type {
  AonsokuNativeAudioPlugin,
  NativeAudioLoadOptions,
  NativeAudioMetadata,
  NativeAudioQueueOptions,
  NativeAudioRepeatModeOptions,
  NativeAudioSeekOptions,
  NativeAudioShuffleOptions,
  NativeAudioSource,
} from "./definitions";
import { NATIVE_AUDIO_PLUGIN_NAME } from "./definitions";

export function createNativeAudioUnavailableError(method: string) {
  return new Error(
    `${NATIVE_AUDIO_PLUGIN_NAME}.${method} is only available in Capacitor iOS.`,
  );
}

export class AonsokuNativeAudioWeb
  extends WebPlugin
  implements AonsokuNativeAudioPlugin
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
