import type { PluginListenerHandle } from "@capacitor/core";
import type {
  NativeAudioEventName,
  NativeAudioEvents,
  NativeAudioPlugin,
  NativeAudioSource,
} from "@/native/audio";
import {
  type PlaybackBackend,
  type PlaybackBackendEvent,
  type PlaybackBackendEvents,
  type PlaybackBackendListener,
  type PlaybackErrorEvent,
  type PlaybackRepeatMode,
  type PlaybackSource,
  type UnsubscribePlaybackEvent,
} from "./types";

type ListenerMap = {
  [TEvent in PlaybackBackendEvent]: Set<PlaybackBackendListener<TEvent>>;
};

export class NativeAudioPlaybackBackend implements PlaybackBackend {
  readonly #plugin: NativeAudioPlugin;
  readonly #listeners: ListenerMap;
  readonly #nativeListenerHandles: Array<
    Promise<PluginListenerHandle | null>
  > = [];
  #disposed = false;

  constructor(plugin: NativeAudioPlugin) {
    this.#plugin = plugin;
    this.#listeners = {
      progress: new Set(),
      duration: new Set(),
      buffering: new Set(),
      ended: new Set(),
      play: new Set(),
      pause: new Set(),
      error: new Set(),
    };
    this.#wireNativeEvents();
  }

  load(source: PlaybackSource) {
    this.#assertActive();
    return this.#plugin.load({ source: toNativeAudioSource(source) });
  }

  play() {
    this.#assertActive();
    return this.#plugin.play();
  }

  pause() {
    this.#assertActive();
    return this.#plugin.pause();
  }

  stop() {
    this.#assertActive();
    return this.#plugin.stop();
  }

  seek(seconds: number) {
    this.#assertActive();
    return this.#plugin.seek({ position: Math.max(0, seconds) });
  }

  setLoop(enabled: boolean) {
    return this.setRepeatMode(enabled ? "one" : "off");
  }

  setRepeatMode(mode: PlaybackRepeatMode) {
    this.#assertActive();
    return this.#plugin.setRepeatMode({ mode });
  }

  setShuffle(enabled: boolean) {
    this.#assertActive();
    return this.#plugin.setShuffle({ enabled });
  }

  skipToNext() {
    this.#assertActive();
    return this.#plugin.skipToNext();
  }

  skipToPrevious() {
    this.#assertActive();
    return this.#plugin.skipToPrevious();
  }

  setVolume(_value: number) {
    this.#assertActive();
    return Promise.resolve();
  }

  preload(source: PlaybackSource) {
    this.#assertActive();
    return this.#plugin.preload({ source: toNativeAudioSource(source) });
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    for (const handlePromise of this.#nativeListenerHandles) {
      handlePromise.then((handle) => handle?.remove()).catch(() => {});
    }
    this.#nativeListenerHandles.length = 0;

    for (const listeners of Object.values(this.#listeners)) {
      listeners.clear();
    }

    this.#plugin.clear().catch(() => {});
  }

  subscribe<TEvent extends PlaybackBackendEvent>(
    event: TEvent,
    listener: PlaybackBackendListener<TEvent>,
  ): UnsubscribePlaybackEvent {
    this.#listeners[event].add(listener);

    return () => {
      this.#listeners[event].delete(listener);
    };
  }

  #wireNativeEvents() {
    this.#addNativeListener("progress", (event) => {
      this.#emit("progress", {
        currentTime: event.currentTime,
        duration: event.duration,
        bufferedTime: event.bufferedTime ?? event.currentTime,
      });
    });
    this.#addNativeListener("durationChanged", (event) => {
      this.#emit("duration", { duration: event.duration });
    });
    this.#addNativeListener("bufferingChanged", (event) => {
      this.#emit("buffering", { isBuffering: event.isBuffering });
    });
    this.#addNativeListener("ended", () => {
      this.#emit("ended", undefined);
    });
    this.#addNativeListener("error", (event) => {
      this.#emit("error", {
        error: event,
        code: event.code,
        message: event.message,
      });
    });
    this.#addNativeListener("playbackStateChanged", (event) => {
      if (event.state === "playing") {
        this.#emit("play", undefined);
      } else if (
        event.state === "paused" ||
        event.state === "stopped" ||
        event.state === "ended"
      ) {
        this.#emit("pause", undefined);
      }
    });
  }

  #addNativeListener<TEvent extends NativeAudioEventName>(
    event: TEvent,
    listener: (payload: NativeAudioEvents[TEvent]) => void,
  ) {
    const handlePromise = this.#plugin
      .addListener(event, listener)
      .then((handle) => handle)
      .catch((error: unknown) => {
        this.#emit("error", toPlaybackErrorEvent(error));
        return null;
      });
    this.#nativeListenerHandles.push(handlePromise);
  }

  #emit<TEvent extends PlaybackBackendEvent>(
    event: TEvent,
    payload: PlaybackBackendEvents[TEvent],
  ) {
    if (this.#disposed) return;

    for (const listener of this.#listeners[event]) {
      listener(payload);
    }
  }

  #assertActive() {
    if (this.#disposed) {
      throw new Error("Playback backend has been disposed");
    }
  }
}

export function createNativeAudioPlaybackBackend(plugin: NativeAudioPlugin) {
  return new NativeAudioPlaybackBackend(plugin);
}

export function toNativeAudioSource(source: PlaybackSource): NativeAudioSource {
  switch (source.kind) {
    case "stream":
      return {
        kind: "stream",
        url: source.url,
        songId: source.songId,
      };
    case "blob":
      return {
        kind: "blob",
        url: source.url,
        songId: source.songId,
      };
    case "native-file":
      return {
        kind: "native-file",
        uri: source.uri,
        songId: source.songId,
      };
    case "radio":
      return {
        kind: "radio",
        url: source.url,
        radioId: source.radioId,
      };
  }
}

function toPlaybackErrorEvent(error: unknown): PlaybackErrorEvent {
  if (error instanceof Error) {
    return {
      error,
      message: error.message,
    };
  }

  return {
    error,
    message: "Native audio listener failed",
  };
}
