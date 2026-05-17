import { describe, expect, it, vi } from "vitest";
import type { NativeAudioPlugin } from "@/native/audio";
import {
  createPlaybackBackend,
  shouldUseNativePlaybackBackend,
  type PlaybackBackend,
} from ".";

function makeAudio() {
  return {} as HTMLAudioElement;
}

function makeBackend(): PlaybackBackend {
  return {
    load: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setLoop: vi.fn(),
    setRepeatMode: vi.fn(),
    setShuffle: vi.fn(),
    skipToNext: vi.fn(),
    skipToPrevious: vi.fn(),
    setVolume: vi.fn(),
    preload: vi.fn(),
    dispose: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  };
}

function makeAvailablePlugin() {
  return {
    available: true,
    plugin: {} as NativeAudioPlugin,
  } as const;
}

describe("playback backend selection", () => {
  it("uses the web backend outside Capacitor iOS", () => {
    const webBackend = makeBackend();
    const nativeBackend = makeBackend();

    const selection = createPlaybackBackend(makeAudio(), {
      getRuntime: () => "web",
      getNativeAudioAvailability: makeAvailablePlugin,
      createWebBackend: () => webBackend,
      createNativeBackend: () => nativeBackend,
    });

    expect(selection).toEqual({
      backend: webBackend,
      kind: "web",
    });
  });

  it("uses the native backend when Capacitor iOS exposes the plugin", () => {
    const webBackend = makeBackend();
    const nativeBackend = makeBackend();

    const selection = createPlaybackBackend(makeAudio(), {
      getRuntime: () => "capacitor-ios",
      getNativeAudioAvailability: makeAvailablePlugin,
      createWebBackend: () => webBackend,
      createNativeBackend: () => nativeBackend,
    });

    expect(selection).toEqual({
      backend: nativeBackend,
      kind: "native",
    });
  });

  it("falls back to web on Capacitor iOS when the plugin is missing", () => {
    const webBackend = makeBackend();
    const nativeFactory = vi.fn(() => makeBackend());

    const selection = createPlaybackBackend(makeAudio(), {
      getRuntime: () => "capacitor-ios",
      getNativeAudioAvailability: () => ({
        available: false,
        reason: "missing-plugin",
        message: "missing",
      }),
      createWebBackend: () => webBackend,
      createNativeBackend: nativeFactory,
    });

    expect(selection).toEqual({
      backend: webBackend,
      kind: "web",
      fallbackReason: "missing-plugin",
    });
    expect(nativeFactory).not.toHaveBeenCalled();
  });

  it("falls back to web if native backend construction fails", () => {
    const webBackend = makeBackend();

    const selection = createPlaybackBackend(makeAudio(), {
      getRuntime: () => "capacitor-ios",
      getNativeAudioAvailability: makeAvailablePlugin,
      createWebBackend: () => webBackend,
      createNativeBackend: () => {
        throw new Error("native unavailable");
      },
    });

    expect(selection).toEqual({
      backend: webBackend,
      kind: "web",
      fallbackReason: "native unavailable",
    });
  });

  it("reports whether native playback should be used", () => {
    expect(
      shouldUseNativePlaybackBackend({
        getRuntime: () => "web",
        getNativeAudioAvailability: makeAvailablePlugin,
      }),
    ).toBe(false);
    expect(
      shouldUseNativePlaybackBackend({
        getRuntime: () => "capacitor-ios",
        getNativeAudioAvailability: () => ({
          available: false,
          reason: "missing-plugin",
          message: "missing",
        }),
      }),
    ).toBe(false);
    expect(
      shouldUseNativePlaybackBackend({
        getRuntime: () => "capacitor-ios",
        getNativeAudioAvailability: makeAvailablePlugin,
      }),
    ).toBe(true);
  });
});
