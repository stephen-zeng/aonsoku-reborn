import type { PluginListenerHandle } from "@capacitor/core";
import type {
  NativeAudioPlugin,
  PlaybackStateChangedEvent,
  TimeUpdateEvent,
  BufferedProgressEvent,
  PlaybackErrorEvent,
  MediaSessionActionEvent,
} from "aonsoku-native-audio";
import type {
  PlaybackEngine,
  PlaybackEngineEvents,
  PlaybackError,
  ReplayGainConfig,
} from "../types";

type EventMap = PlaybackEngineEvents;
type Listeners = { [K in keyof EventMap]: Set<EventMap[K]> };

export class CapacitorPlaybackEngine implements PlaybackEngine {
  private plugin: NativeAudioPlugin;
  private handles: PluginListenerHandle[] = [];
  private destroyed = false;
  private currentTime = 0;
  private duration = 0;
  private paused = true;
  private ended = false;
  private srcSet = false;
  private mediaSessionHandler:
    | ((action: string, seekTime?: number) => void)
    | null = null;

  private listeners: Listeners = {
    play: new Set(),
    pause: new Set(),
    ended: new Set(),
    timeUpdate: new Set(),
    durationChange: new Set(),
    bufferedProgress: new Set(),
    waiting: new Set(),
    playing: new Set(),
    canPlay: new Set(),
    seeked: new Set(),
    error: new Set(),
  };

  constructor(plugin: NativeAudioPlugin) {
    this.plugin = plugin;
  }

  async initialize(): Promise<void> {
    const h1 = await this.plugin.addListener(
      "playbackStateChanged",
      (data: PlaybackStateChangedEvent) => {
        switch (data.state) {
          case "playing":
            this.paused = false;
            this.ended = false;
            this.emit("play");
            this.emit("playing");
            break;
          case "paused":
            this.paused = true;
            this.emit("pause");
            break;
          case "stopped":
            this.paused = true;
            break;
          case "buffering":
            this.emit("waiting");
            break;
        }
      },
    );

    const h2 = await this.plugin.addListener(
      "timeUpdate",
      (data: TimeUpdateEvent) => {
        this.currentTime = data.currentTime;
        if (data.duration > 0 && data.duration !== this.duration) {
          this.duration = data.duration;
          this.emit("durationChange", data.duration);
        }
        this.emit("timeUpdate", data.currentTime);
      },
    );

    const h3 = await this.plugin.addListener(
      "bufferedProgress",
      (data: BufferedProgressEvent) => {
        this.emit("bufferedProgress", data.buffered);
      },
    );

    const h4 = await this.plugin.addListener("playbackEnded", () => {
      this.ended = true;
      this.paused = true;
      this.emit("ended");
    });

    const h5 = await this.plugin.addListener(
      "playbackError",
      (data: PlaybackErrorEvent) => {
        const error: PlaybackError = {
          code: (data.code as PlaybackError["code"]) || "unknown",
          message: data.message,
          retriable: data.code === "network",
        };
        this.emit("error", error);
      },
    );

    const h6 = await this.plugin.addListener(
      "mediaSessionAction",
      (data: MediaSessionActionEvent) => {
        this.mediaSessionHandler?.(data.action, data.seekTime);
      },
    );

    this.handles = [h1, h2, h3, h4, h5, h6];
  }

  setMediaSessionHandler(
    handler: ((action: string, seekTime?: number) => void) | null,
  ): void {
    this.mediaSessionHandler = handler;
  }

  destroy(): void {
    this.destroyed = true;
    for (const handle of this.handles) {
      handle.remove();
    }
    this.handles = [];
    this.plugin.stop();
  }

  setSrc(url: string, songId: string): void {
    this.srcSet = true;
    this.ended = false;
    this.currentTime = 0;
    this.duration = 0;
    this.plugin.setSrc({ url, songId });
  }

  clearSrc(): void {
    this.srcSet = false;
    this.plugin.stop();
  }

  async play(): Promise<void> {
    await this.plugin.play();
  }

  pause(): void {
    this.plugin.pause();
  }

  seek(time: number): void {
    this.currentTime = time;
    this.plugin.seek({ time });
  }

  setVolume(volume: number): void {
    this.plugin.setVolume({ volume });
  }

  setReplayGain(config: ReplayGainConfig | null): void {
    if (!config) {
      this.plugin.setReplayGain({ gain: 1.0, enabled: false });
      return;
    }
    this.plugin.setReplayGain({
      gain: config.gainValue,
      enabled: config.enabled,
    });
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isEnded(): boolean {
    return this.ended;
  }

  hasSrc(): boolean {
    return this.srcSet;
  }

  getReadyState(): number {
    return this.srcSet ? 4 : 0;
  }

  on<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
    this.listeners[event].add(handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
    this.listeners[event].delete(handler);
  }

  private emit<K extends keyof EventMap>(
    event: K,
    ...args: Parameters<EventMap[K]>
  ): void {
    if (this.destroyed) return;
    for (const handler of this.listeners[event]) {
      (handler as (...a: unknown[]) => void)(...args);
    }
  }
}
