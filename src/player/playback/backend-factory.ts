import {
  getNativeAudioPluginAvailability,
  type NativeAudioPluginAvailability,
} from "@/native/audio";
import {
  getPlaybackCapabilities,
  getRuntime,
  type PlatformRuntime,
} from "@/utils/capabilities";
import {
  createNativeAudioPlaybackBackend,
  type NativeAudioPlaybackBackend,
} from "./native-backend";
import { createTauriAudioPlaybackBackend } from "./tauri-backend";
import type { PlaybackBackend } from "./types";
import {
  createWebAudioPlaybackBackend,
  type WebAudioPlaybackBackendOptions,
} from "./web-backend";

export type PlaybackBackendKind = "web" | "native" | "tauri";

export interface PlaybackBackendSelection {
  backend: PlaybackBackend;
  kind: PlaybackBackendKind;
  fallbackReason?: string;
}

export interface PlaybackBackendSelectionOptions {
  createNativeBackend?: (
    availability: Extract<NativeAudioPluginAvailability, { available: true }>,
  ) => PlaybackBackend;
  createTauriBackend?: () => PlaybackBackend;
  createWebBackend?: (audio: HTMLAudioElement) => PlaybackBackend;
  getNativeAudioAvailability?: () => NativeAudioPluginAvailability;
  getCapabilities?: () => ReturnType<typeof getPlaybackCapabilities>;
  getRuntime?: () => PlatformRuntime;
  isTauriPlaybackAvailable?: () => boolean;
  webOptions?: WebAudioPlaybackBackendOptions;
}

export function createPlaybackBackend(
  audio: HTMLAudioElement,
  options: PlaybackBackendSelectionOptions = {},
): PlaybackBackendSelection {
  const createWebBackend =
    options.createWebBackend ??
    ((webAudio: HTMLAudioElement) =>
      createWebAudioPlaybackBackend(webAudio, options.webOptions));
  const runtime = (options.getRuntime ?? getRuntime)();

  if (runtime === "tauri") {
    return {
      backend:
        options.createTauriBackend?.() ?? createTauriAudioPlaybackBackend(),
      kind: "tauri",
    };
  }

  const caps = (options.getCapabilities ?? getPlaybackCapabilities)();
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
    | "getNativeAudioAvailability"
    | "getCapabilities"
    | "getRuntime"
    | "isTauriPlaybackAvailable"
  > = {},
) {
  const runtime = (options.getRuntime ?? getRuntime)();
  if (runtime === "tauri") {
    return true;
  }

  const caps = (options.getCapabilities ?? getPlaybackCapabilities)();
  if (!caps.supportsNativePlayback) {
    return false;
  }

  return (
    options.getNativeAudioAvailability ?? getNativeAudioPluginAvailability
  )().available;
}

export type { NativeAudioPlaybackBackend };
