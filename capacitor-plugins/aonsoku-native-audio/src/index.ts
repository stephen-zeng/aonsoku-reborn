import { registerPlugin } from "@capacitor/core";
import type { AonsokuNativeAudioPlugin } from "./definitions";
import {
  NATIVE_AUDIO_PLUGIN_NAME,
  type NativeAudioEventName,
  type NativeAudioEvents,
  type NativeAudioLoadOptions,
  type NativeAudioMetadata,
  type NativeAudioQueueOptions,
  type NativeAudioRepeatModeOptions,
  type NativeAudioSeekOptions,
  type NativeAudioShuffleOptions,
  type NativeAudioSource,
} from "./definitions";
import { AonsokuNativeAudioWeb } from "./web";

export const AonsokuNativeAudio = registerPlugin<AonsokuNativeAudioPlugin>(
  NATIVE_AUDIO_PLUGIN_NAME,
  {
    web: () => new AonsokuNativeAudioWeb(),
  },
);

export {
  AonsokuNativeAudioWeb,
  createNativeAudioUnavailableError,
} from "./web";
export { NATIVE_AUDIO_PLUGIN_NAME };
export type {
  AonsokuNativeAudioPlugin,
  NativeAudioEventName,
  NativeAudioEvents,
  NativeAudioLoadOptions,
  NativeAudioMetadata,
  NativeAudioQueueOptions,
  NativeAudioRepeatModeOptions,
  NativeAudioSeekOptions,
  NativeAudioShuffleOptions,
  NativeAudioSource,
};
