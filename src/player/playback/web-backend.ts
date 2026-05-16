import {
  createUrlPlaybackSource,
  getPlaybackSourceUrl,
  type PlaybackBackend,
  type PlaybackBackendEvent,
  type PlaybackBackendEvents,
  type PlaybackBackendListener,
  type PlaybackErrorEvent,
  type PlaybackProgressEvent,
  type PlaybackSource,
  type UnsubscribePlaybackEvent,
} from "./types";

type ListenerMap = {
  [TEvent in PlaybackBackendEvent]: Set<PlaybackBackendListener<TEvent>>;
};

type DomListenerCleanup = () => void;

export interface WebAudioPlaybackBackendOptions {
  createPreloadElement?: () => HTMLAudioElement;
}

export class WebAudioPlaybackBackend implements PlaybackBackend {
  readonly #audio: HTMLAudioElement;
  readonly #createPreloadElement: () => HTMLAudioElement;
  readonly #listeners: ListenerMap;
  readonly #domListenerCleanups: DomListenerCleanup[] = [];
  #preloadAudio: HTMLAudioElement | null = null;
  #disposed = false;

  constructor(
    audio: HTMLAudioElement,
    options: WebAudioPlaybackBackendOptions = {},
  ) {
    this.#audio = audio;
    this.#createPreloadElement =
      options.createPreloadElement ?? (() => new Audio());
    this.#listeners = {
      progress: new Set(),
      duration: new Set(),
      buffering: new Set(),
      ended: new Set(),
      play: new Set(),
      pause: new Set(),
      error: new Set(),
    };
    this.#wireAudioEvents();
  }

  load(source: PlaybackSource) {
    this.#assertActive();
    this.#audio.src = getPlaybackSourceUrl(source);
    this.#audio.load();
  }

  play() {
    this.#assertActive();
    return this.#audio.play() ?? Promise.resolve();
  }

  pause() {
    this.#assertActive();
    this.#audio.pause();
  }

  stop() {
    this.#assertActive();
    this.#audio.pause();
    this.seek(0);
  }

  seek(seconds: number) {
    this.#assertActive();
    this.#audio.currentTime = Math.max(0, seconds);
  }

  setLoop(enabled: boolean) {
    this.#assertActive();
    this.#audio.loop = enabled;
  }

  setVolume(value: number) {
    this.#assertActive();
    this.#audio.volume = Math.min(Math.max(value, 0), 1);
  }

  preload(source: PlaybackSource) {
    this.#assertActive();
    if (!this.#preloadAudio) {
      this.#preloadAudio = this.#createPreloadElement();
      this.#preloadAudio.preload = "auto";
    }

    this.#preloadAudio.src = getPlaybackSourceUrl(source);
    this.#preloadAudio.load();
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    for (const cleanup of this.#domListenerCleanups) cleanup();
    this.#domListenerCleanups.length = 0;

    if (this.#preloadAudio) {
      this.#preloadAudio.removeAttribute("src");
      this.#preloadAudio.load();
      this.#preloadAudio = null;
    }

    for (const listeners of Object.values(this.#listeners)) {
      listeners.clear();
    }
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

  #wireAudioEvents() {
    this.#addDomListener("timeupdate", () => {
      this.#emit("progress", this.#getProgressEvent());
    });
    this.#addDomListener("progress", () => {
      this.#emit("progress", this.#getProgressEvent());
    });
    this.#addDomListener("durationchange", () => {
      this.#emit("duration", { duration: this.#safeDuration() });
    });
    this.#addDomListener("loadedmetadata", () => {
      this.#emit("duration", { duration: this.#safeDuration() });
    });
    this.#addDomListener("waiting", () => {
      this.#emit("buffering", { isBuffering: true });
    });
    this.#addDomListener("stalled", () => {
      this.#emit("buffering", { isBuffering: true });
    });
    this.#addDomListener("playing", () => {
      this.#emit("buffering", { isBuffering: false });
    });
    this.#addDomListener("canplay", () => {
      this.#emit("buffering", { isBuffering: false });
    });
    this.#addDomListener("ended", () => {
      this.#emit("ended", undefined);
    });
    this.#addDomListener("play", () => {
      this.#emit("play", undefined);
    });
    this.#addDomListener("pause", () => {
      this.#emit("pause", undefined);
    });
    this.#addDomListener("error", () => {
      this.#emit("error", this.#getErrorEvent());
    });
  }

  #addDomListener(type: string, listener: EventListener) {
    this.#audio.addEventListener(type, listener);
    this.#domListenerCleanups.push(() => {
      this.#audio.removeEventListener(type, listener);
    });
  }

  #emit<TEvent extends PlaybackBackendEvent>(
    event: TEvent,
    payload: PlaybackBackendEvents[TEvent],
  ) {
    for (const listener of this.#listeners[event]) {
      listener(payload);
    }
  }

  #getProgressEvent(): PlaybackProgressEvent {
    return {
      currentTime: this.#audio.currentTime || 0,
      duration: this.#safeDuration(),
      bufferedTime: this.#safeBufferedTime(),
    };
  }

  #getErrorEvent(): PlaybackErrorEvent {
    const error = this.#audio.error;

    return {
      error,
      code: error?.code,
      message: error?.message,
    };
  }

  #safeDuration() {
    const duration = this.#audio.duration;

    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  #safeBufferedTime() {
    const buffered = this.#audio.buffered;
    if (buffered.length === 0) return 0;

    return Math.min(buffered.end(buffered.length - 1), this.#safeDuration());
  }

  #assertActive() {
    if (this.#disposed) {
      throw new Error("Playback backend has been disposed");
    }
  }
}

export function createWebAudioPlaybackBackend(
  audio: HTMLAudioElement,
  options?: WebAudioPlaybackBackendOptions,
) {
  return new WebAudioPlaybackBackend(audio, options);
}

export function createWebUrlPlaybackSource(
  url: string,
  options?: Parameters<typeof createUrlPlaybackSource>[1],
) {
  return createUrlPlaybackSource(url, options);
}
