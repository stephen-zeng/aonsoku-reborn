import {
  getNativeAudioPluginAvailability,
  type NativeAudioPluginAvailability,
} from "@/native/audio";
import { getPlaybackCapabilities } from "@/utils/capabilities";
import {
  createNativeAudioPlaybackBackend,
  type NativeAudioPlaybackBackend,
} from "./native-backend";
import type { PlaybackBackend } from "./types";
import {
  createWebAudioPlaybackBackend,
  type WebAudioPlaybackBackendOptions,
} from "./web-backend";

export type PlaybackBackendKind = "web" | "native";

export interface PlaybackBackendSelection {
  backend: PlaybackBackend;
  kind: PlaybackBackendKind;
  fallbackReason?: string;
}

export interface PlaybackBackendSelectionOptions {
  createNativeBackend?: (
    availability: Extract<NativeAudioPluginAvailability, { available: true }>,
  ) => PlaybackBackend;
  createWebBackend?: (audio: HTMLAudioElement) => PlaybackBackend;
  getNativeAudioAvailability?: () => NativeAudioPluginAvailability;
  getCapabilities?: () => ReturnType<typeof getPlaybackCapabilities>;
  webOptions?: WebAudioPlaybackBackendOptions;
}

export function createPlaybackBackend(
  audio: HTMLAudioElement,
  options: PlaybackBackendSelectionOptions = {},
): PlaybackBackendSelection {
  const caps = (options.getCapabilities ?? getPlaybackCapabilities)();
  const createWebBackend =
    options.createWebBackend ??
    ((webAudio: HTMLAudioElement) =>
      createWebAudioPlaybackBackend(webAudio, options.webOptions));

  if (!caps.supportsNativePlayback) {
    return {
      backend: createWebBackend(audio),
      kind: "web",
    };
  }

  const availability = (
    options.getNativeAudioAvailability ?? getNativeAudioPluginAvailability
  )();

  if (!availability.available) {
    return {
      backend: createWebBackend(audio),
      kind: "web",
      fallbackReason: availability.reason,
    };
  }

  try {
    return {
      backend:
        options.createNativeBackend?.(availability) ??
        createNativeAudioPlaybackBackend(availability.plugin),
      kind: "native",
    };
  } catch (error) {
    return {
      backend: createWebBackend(audio),
      kind: "web",
      fallbackReason:
        error instanceof Error ? error.message : "native-backend-error",
    };
  }
}

export function shouldUseNativePlaybackBackend(
  options: Pick<
    PlaybackBackendSelectionOptions,
    "getNativeAudioAvailability" | "getCapabilities"
  > = {},
) {
  const caps = (options.getCapabilities ?? getPlaybackCapabilities)();
  if (!caps.supportsNativePlayback) {
    return false;
  }

  return (
    options.getNativeAudioAvailability ?? getNativeAudioPluginAvailability
  )().available;
}

export type { NativeAudioPlaybackBackend };
