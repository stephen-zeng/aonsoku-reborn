import { registerPlugin } from "@capacitor/core";
import type { AonsokuNativeAudioPlugin } from "./definitions";
import {
  NATIVE_AUDIO_PLUGIN_NAME,
  type NativeAudioCachedAudioFile,
  type NativeAudioClearFilesResult,
  type NativeAudioDeleteFileResult,
  type NativeAudioEventName,
  type NativeAudioEvents,
  type NativeAudioFileOptions,
  type NativeAudioFileSizeResult,
  type NativeAudioLoadOptions,
  type NativeAudioMetadata,
  type NativeAudioQueueOptions,
  type NativeAudioRepeatModeOptions,
  type NativeAudioResolveFileResult,
  type NativeAudioSeekOptions,
  type NativeAudioShuffleOptions,
  type NativeAudioSource,
  type NativeAudioStoreFileOptions,
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
  NativeAudioCachedAudioFile,
  NativeAudioClearFilesResult,
  NativeAudioDeleteFileResult,
  NativeAudioEventName,
  NativeAudioEvents,
  NativeAudioFileOptions,
  NativeAudioFileSizeResult,
  NativeAudioLoadOptions,
  NativeAudioMetadata,
  NativeAudioQueueOptions,
  NativeAudioRepeatModeOptions,
  NativeAudioResolveFileResult,
  NativeAudioSeekOptions,
  NativeAudioShuffleOptions,
  NativeAudioSource,
  NativeAudioStoreFileOptions,
};
