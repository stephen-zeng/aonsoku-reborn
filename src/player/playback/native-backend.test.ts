import { describe, expect, it, vi } from "vitest";
import type { NativeAudioEvents, NativeAudioPlugin } from "@/native/audio";
import {
  createUrlPlaybackSource,
  NativeAudioPlaybackBackend,
  toNativeAudioSource,
  type PlaybackBackendEvent,
  type PlaybackBackendListener,
} from ".";

type ListenerMap = {
  [TEvent in keyof NativeAudioEvents]?: Array<
    (event: NativeAudioEvents[TEvent]) => void
  >;
};

function createPlugin() {
  const listeners: ListenerMap = {};
  const plugin: NativeAudioPlugin = {
    load: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    seek: vi.fn(async () => {}),
    setRepeatMode: vi.fn(async () => {}),
    setShuffle: vi.fn(async () => {}),
    setQueue: vi.fn(async () => {}),
    skipToNext: vi.fn(async () => {}),
    skipToPrevious: vi.fn(async () => {}),
    updateMetadata: vi.fn(async () => {}),
    preload: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    addListener: vi.fn(async (eventName, listener) => {
      listeners[eventName] ??= [];
      listeners[eventName]?.push(listener);

      return {
        remove: vi.fn(async () => {
          listeners[eventName] = listeners[eventName]?.filter(
            (item) => item !== listener,
          );
        }),
      };
    }),
    removeAllListeners: vi.fn(async () => {}),
  };

  function emit<TEvent extends keyof NativeAudioEvents>(
    eventName: TEvent,
    event: NativeAudioEvents[TEvent],
  ) {
    for (const listener of listeners[eventName] ?? []) {
      listener(event);
    }
  }

  return { plugin, emit };
}

describe("NativeAudioPlaybackBackend", () => {
  it("maps playback sources to native audio sources", () => {
    expect(
      toNativeAudioSource(
        createUrlPlaybackSource("https://server/rest/stream?id=song-1", {
          songId: "song-1",
        }),
      ),
    ).toEqual({
      kind: "stream",
      url: "https://server/rest/stream?id=song-1",
      songId: "song-1",
    });
    expect(
      toNativeAudioSource({
        kind: "native-file",
        uri: "file:///Library/Caches/song.flac",
        songId: "song-2",
      }),
    ).toEqual({
      kind: "native-file",
      uri: "file:///Library/Caches/song.flac",
      songId: "song-2",
    });
    expect(
      toNativeAudioSource(
        createUrlPlaybackSource("https://radio.example/stream", {
          kind: "radio",
          radioId: "radio-1",
        }),
      ),
    ).toEqual({
      kind: "radio",
      url: "https://radio.example/stream",
      radioId: "radio-1",
    });
  });

  it("delegates backend controls to the native plugin", async () => {
    const { plugin } = createPlugin();
    const backend = new NativeAudioPlaybackBackend(plugin);
    const source = createUrlPlaybackSource("https://server/song.mp3", {
      songId: "song-1",
    });
    const preloadSource = createUrlPlaybackSource("https://server/next.mp3", {
      songId: "song-2",
    });

    await backend.load(source);
    await backend.play();
    await backend.pause();
    await backend.stop();
    await backend.seek(-12);
    await backend.setLoop(true);
    await backend.setRepeatMode("all");
    await backend.setShuffle(true);
    await backend.skipToNext();
    await backend.skipToPrevious();
    await backend.setVolume(0.5);
    await backend.preload(preloadSource);

    expect(plugin.load).toHaveBeenCalledWith({
      source: {
        kind: "stream",
        url: "https://server/song.mp3",
        songId: "song-1",
      },
    });
    expect(plugin.play).toHaveBeenCalledTimes(1);
    expect(plugin.pause).toHaveBeenCalledTimes(1);
    expect(plugin.stop).toHaveBeenCalledTimes(1);
    expect(plugin.seek).toHaveBeenCalledWith({ position: 0 });
    expect(plugin.setRepeatMode).toHaveBeenCalledWith({ mode: "one" });
    expect(plugin.setRepeatMode).toHaveBeenCalledWith({ mode: "all" });
    expect(plugin.setShuffle).toHaveBeenCalledWith({ enabled: true });
    expect(plugin.skipToNext).toHaveBeenCalledTimes(1);
    expect(plugin.skipToPrevious).toHaveBeenCalledTimes(1);
    expect(plugin.preload).toHaveBeenCalledWith({
      source: {
        kind: "stream",
        url: "https://server/next.mp3",
        songId: "song-2",
      },
    });
  });

  it("maps native events to playback backend events", async () => {
    const { plugin, emit } = createPlugin();
    const backend = new NativeAudioPlaybackBackend(plugin);
    const listeners = makePlaybackListeners();

    backend.subscribe("progress", listeners.progress);
    backend.subscribe("duration", listeners.duration);
    backend.subscribe("buffering", listeners.buffering);
    backend.subscribe("play", listeners.play);
    backend.subscribe("pause", listeners.pause);
    backend.subscribe("ended", listeners.ended);
    backend.subscribe("error", listeners.error);

    await Promise.resolve();

    emit("progress", {
      currentTime: 32,
      duration: 180,
      bufferedTime: 90,
    });
    emit("durationChanged", { duration: 181 });
    emit("bufferingChanged", { isBuffering: true });
    emit("playbackStateChanged", { state: "playing" });
    emit("playbackStateChanged", { state: "paused" });
    emit("ended", { reason: "finished" });
    emit("error", { code: "network", message: "Native stream failed" });

    expect(listeners.progress).toHaveBeenCalledWith({
      currentTime: 32,
      duration: 180,
      bufferedTime: 90,
    });
    expect(listeners.duration).toHaveBeenCalledWith({ duration: 181 });
    expect(listeners.buffering).toHaveBeenCalledWith({ isBuffering: true });
    expect(listeners.play).toHaveBeenCalledTimes(1);
    expect(listeners.pause).toHaveBeenCalledTimes(1);
    expect(listeners.ended).toHaveBeenCalledTimes(1);
    expect(listeners.error).toHaveBeenCalledWith({
      error: {
        code: "network",
        message: "Native stream failed",
      },
      code: "network",
      message: "Native stream failed",
    });
  });

  it("removes native listeners and clears plugin state on dispose", async () => {
    const { plugin, emit } = createPlugin();
    const backend = new NativeAudioPlaybackBackend(plugin);
    const progress = vi.fn();

    backend.subscribe("progress", progress);
    await Promise.resolve();
    backend.dispose();
    await Promise.resolve();

    emit("progress", { currentTime: 1, duration: 2 });

    expect(progress).not.toHaveBeenCalled();
    expect(plugin.clear).toHaveBeenCalledTimes(1);
    expect(() => backend.play()).toThrow("Playback backend has been disposed");
  });
});

function makePlaybackListeners() {
  return {
    progress: vi.fn() as PlaybackBackendListener<"progress">,
    duration: vi.fn() as PlaybackBackendListener<"duration">,
    buffering: vi.fn() as PlaybackBackendListener<"buffering">,
    ended: vi.fn() as PlaybackBackendListener<"ended">,
    play: vi.fn() as PlaybackBackendListener<"play">,
    pause: vi.fn() as PlaybackBackendListener<"pause">,
    error: vi.fn() as PlaybackBackendListener<"error">,
  } satisfies {
    [TEvent in PlaybackBackendEvent]: PlaybackBackendListener<TEvent>;
  };
}
