import { hasTauriBridge } from "@/utils/desktop";
import { logger } from "@/utils/logger";
import { getTauriInvoke, listenTauriEvent } from "@/utils/tauri";
import type {
  PlaybackBackend,
  PlaybackBackendEvent,
  PlaybackBackendEvents,
  PlaybackBackendListener,
  PlaybackErrorKind,
  PlaybackMetadata,
  PlaybackRepeatMode,
  PlaybackSource,
  UnsubscribePlaybackEvent,
} from "./types";

const TAURI_DESKTOP_AUDIO_EVENT = "desktop-audio-event";

type ListenerMap = {
  [TEvent in PlaybackBackendEvent]: Set<PlaybackBackendListener<TEvent>>;
};

type TauriDesktopAudioEvent =
  | {
      type: "progress";
      requestId?: string;
      currentTime?: number;
      duration?: number;
      bufferedTime?: number;
    }
  | {
      type: "duration";
      requestId?: string;
      duration?: number;
    }
  | {
      type: "buffering";
      requestId?: string;
      isBuffering?: boolean;
    }
  | {
      type: "play" | "pause" | "ended";
      requestId?: string;
    }
  | {
      type: "error";
      requestId?: string;
      message?: string;
      code?: string;
      nativeCode?: string;
      kind?: PlaybackErrorKind;
    };

export class TauriAudioPlaybackBackend implements PlaybackBackend {
  readonly #listeners: ListenerMap;
  readonly #unlistenPromise: Promise<() => void>;
  #loadSequence = 0;
  #activeRequestId: string | null = null;
  #disposed = false;

  constructor() {
    this.#listeners = {
      progress: new Set(),
      duration: new Set(),
      buffering: new Set(),
      ended: new Set(),
      play: new Set(),
      pause: new Set(),
      error: new Set(),
      remoteCommand: new Set(),
    };
    this.#unlistenPromise = listenTauriEvent<TauriDesktopAudioEvent>(
      TAURI_DESKTOP_AUDIO_EVENT,
      (event) => this.#handleTauriEvent(event.payload),
    );
  }

  load(
    source: PlaybackSource,
    metadata?: PlaybackMetadata,
    options?: { autoplay?: boolean },
  ) {
    this.#assertActive();

    if (source.kind === "blob") {
      this.#emit("error", {
        error: new Error("Tauri native audio cannot play WebView blob URLs"),
        code: "unsupported_source",
        kind: "source-not-supported",
        message: "Tauri native audio cannot play WebView blob URLs",
        nativeCode: "unsupported_source",
      });
      return Promise.resolve();
    }

    const requestId = this.#nextRequestId();
    return this.#invoke("desktop_audio_load", {
      payload: {
        source,
        metadata,
        requestId,
        autoplay: options?.autoplay,
      },
    });
  }

  play() {
    this.#assertActive();
    return this.#invoke("desktop_audio_play");
  }

  pause() {
    this.#assertActive();
    return this.#invoke("desktop_audio_pause");
  }

  stop() {
    this.#assertActive();
    return this.#invoke("desktop_audio_stop");
  }

  seek(seconds: number) {
    this.#assertActive();
    return this.#invoke("desktop_audio_seek", {
      payload: { position: Math.max(0, seconds) },
    });
  }

  setLoop(enabled: boolean) {
    return this.setRepeatMode(enabled ? "one" : "off");
  }

  setRepeatMode(mode: PlaybackRepeatMode) {
    this.#assertActive();
    return this.#invoke("desktop_audio_set_repeat_mode", {
      payload: { mode },
    });
  }

  setShuffle(enabled: boolean) {
    this.#assertActive();
    return this.#invoke("desktop_audio_set_shuffle", {
      payload: { enabled },
    });
  }

  skipToNext() {
    this.#assertActive();
  }

  skipToPrevious() {
    this.#assertActive();
  }

  setVolume(value: number) {
    this.#assertActive();
    return this.#invoke("desktop_audio_set_volume", {
      payload: { value: Math.min(Math.max(value, 0), 1) },
    });
  }

  updateMetadata(metadata: PlaybackMetadata) {
    this.#assertActive();
    return this.#invoke("desktop_audio_update_metadata", {
      payload: { metadata },
    });
  }

  preload(_source: PlaybackSource) {
    this.#assertActive();
  }

  dispose() {
    if (this.#disposed) return;
    this.#invoke("desktop_audio_stop").catch(() => {});
    this.#disposed = true;
    this.#activeRequestId = null;
    this.#unlistenPromise.then((unlisten) => unlisten()).catch(() => {});

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

  async #invoke(command: string, args?: Record<string, unknown>) {
    const invoke = getTauriInvoke();
    if (!invoke) {
      throw new Error("Tauri invoke API is unavailable");
    }

    try {
      await invoke(command, args);
    } catch (error) {
      this.#emit("error", toPlaybackErrorEvent(error));
      throw error;
    }
  }

  #handleTauriEvent(event: TauriDesktopAudioEvent) {
    if (this.#disposed || this.#isStaleEvent(event)) return;

    switch (event.type) {
      case "progress":
        this.#emit("progress", {
          currentTime: validNumber(event.currentTime),
          duration: validNumber(event.duration),
          bufferedTime:
            event.bufferedTime !== undefined
              ? validNumber(event.bufferedTime)
              : validNumber(event.currentTime),
        });
        return;
      case "duration":
        this.#emit("duration", { duration: validNumber(event.duration) });
        return;
      case "buffering":
        this.#emit("buffering", { isBuffering: event.isBuffering === true });
        return;
      case "play":
        this.#emit("play", undefined);
        return;
      case "pause":
        this.#emit("pause", undefined);
        return;
      case "ended":
        this.#emit("ended", undefined);
        return;
      case "error":
        this.#emit("error", {
          error: new Error(event.message ?? "Tauri desktop audio error"),
          code: event.code,
          kind: event.kind,
          message: event.message,
          nativeCode: event.nativeCode,
        });
        return;
    }
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

  #nextRequestId() {
    const requestId = `tauri-audio-${++this.#loadSequence}`;
    this.#activeRequestId = requestId;

    return requestId;
  }

  #isStaleEvent(event: { requestId?: string }) {
    return !!(
      event.requestId &&
      this.#activeRequestId &&
      event.requestId !== this.#activeRequestId
    );
  }

  #assertActive() {
    if (this.#disposed) {
      throw new Error("Playback backend has been disposed");
    }
  }
}

export function createTauriAudioPlaybackBackend() {
  return new TauriAudioPlaybackBackend();
}

export function isTauriAudioPlaybackAvailable() {
  return hasTauriBridge() && getTauriInvoke() !== null;
}

function validNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function toPlaybackErrorEvent(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const kind: PlaybackErrorKind = message.includes("blob")
    ? "source-not-supported"
    : "unknown";

  logger.error("[TauriAudioPlaybackBackend] command failed", error);

  return {
    error,
    code: kind === "source-not-supported" ? "unsupported_source" : "unknown",
    kind,
    message,
    nativeCode:
      kind === "source-not-supported" ? "unsupported_source" : "unknown",
  };
}
