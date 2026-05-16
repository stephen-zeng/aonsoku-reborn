import {
  AudioContext,
  type IAudioContext,
  type IGainNode,
  type IMediaElementAudioSourceNode,
} from "standardized-audio-context";
import type {
  PlaybackEngine,
  PlaybackEngineEvents,
  PlaybackError,
  ReplayGainConfig,
} from "../types";

type IAudioSource = IMediaElementAudioSourceNode<IAudioContext>;
type EventMap = PlaybackEngineEvents;
type Listeners = { [K in keyof EventMap]: Set<EventMap[K]> };

export class WebPlaybackEngine implements PlaybackEngine {
  private audio: HTMLAudioElement;
  private audioContext: IAudioContext | null = null;
  private sourceNode: IAudioSource | null = null;
  private gainNode: IGainNode<IAudioContext> | null = null;
  private resumeDebounce: ReturnType<typeof setTimeout> | null = null;
  private replayGainEnabled = false;
  private destroyed = false;

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

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.playsInline = true;
    this.bindEvents();
  }

  async initialize(): Promise<void> {}

  destroy(): void {
    this.destroyed = true;
    this.unbindEvents();
    this.teardownAudioContext();
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  setSrc(url: string, _songId: string): void {
    this.audio.src = url;
  }

  clearSrc(): void {
    this.audio.removeAttribute("src");
    this.audio.load();
  }

  async play(): Promise<void> {
    if (this.replayGainEnabled) {
      await this.resumeAudioContext();
    }
    await this.audio.play();
  }

  pause(): void {
    this.audio.pause();
  }

  seek(time: number): void {
    this.audio.currentTime = time;
  }

  setVolume(volume: number): void {
    if (!this.replayGainEnabled) {
      this.audio.volume = volume;
    }
  }

  setReplayGain(config: ReplayGainConfig | null): void {
    if (!config || !config.enabled) {
      this.replayGainEnabled = false;
      this.teardownAudioContext();
      return;
    }

    this.replayGainEnabled = true;
    this.audio.volume = 1;
    this.setupAudioContext();

    if (this.gainNode && this.audioContext) {
      const currentTime = this.audioContext.currentTime;
      this.gainNode.gain.cancelScheduledValues(currentTime);
      this.gainNode.gain.setValueAtTime(
        this.gainNode.gain.value,
        currentTime,
      );
      this.gainNode.gain.linearRampToValueAtTime(
        config.gainValue,
        currentTime + 0.05,
      );
    }
  }

  getCurrentTime(): number {
    return this.audio.currentTime;
  }

  getDuration(): number {
    return this.audio.duration || 0;
  }

  isPaused(): boolean {
    return this.audio.paused;
  }

  getReadyState(): number {
    return this.audio.readyState;
  }

  on<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
    this.listeners[event].add(handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventMap[K]): void {
    this.listeners[event].delete(handler);
  }

  getAudioElement(): HTMLAudioElement {
    return this.audio;
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

  private bindEvents(): void {
    this.audio.addEventListener("play", this.onPlay);
    this.audio.addEventListener("pause", this.onPause);
    this.audio.addEventListener("ended", this.onEnded);
    this.audio.addEventListener("timeupdate", this.onTimeUpdate);
    this.audio.addEventListener("durationchange", this.onDurationChange);
    this.audio.addEventListener("progress", this.onProgress);
    this.audio.addEventListener("waiting", this.onWaiting);
    this.audio.addEventListener("playing", this.onPlaying);
    this.audio.addEventListener("canplay", this.onCanPlay);
    this.audio.addEventListener("seeked", this.onSeeked);
    this.audio.addEventListener("error", this.onError);
  }

  private unbindEvents(): void {
    this.audio.removeEventListener("play", this.onPlay);
    this.audio.removeEventListener("pause", this.onPause);
    this.audio.removeEventListener("ended", this.onEnded);
    this.audio.removeEventListener("timeupdate", this.onTimeUpdate);
    this.audio.removeEventListener("durationchange", this.onDurationChange);
    this.audio.removeEventListener("progress", this.onProgress);
    this.audio.removeEventListener("waiting", this.onWaiting);
    this.audio.removeEventListener("playing", this.onPlaying);
    this.audio.removeEventListener("canplay", this.onCanPlay);
    this.audio.removeEventListener("seeked", this.onSeeked);
    this.audio.removeEventListener("error", this.onError);
  }

  // --- PLACEHOLDER_EVENTS ---

  private onPlay = () => this.emit("play");
  private onPause = () => this.emit("pause");
  private onEnded = () => this.emit("ended");
  private onTimeUpdate = () => this.emit("timeUpdate", this.audio.currentTime);
  private onDurationChange = () =>
    this.emit("durationChange", this.audio.duration || 0);
  private onWaiting = () => this.emit("waiting");
  private onPlaying = () => this.emit("playing");
  private onCanPlay = () => this.emit("canPlay");
  private onSeeked = () => this.emit("seeked");

  private onProgress = () => {
    const { buffered, duration } = this.audio;
    if (buffered.length > 0 && duration > 0) {
      const end = buffered.end(buffered.length - 1);
      this.emit("bufferedProgress", end / duration);
    }
  };

  private onError = () => {
    const error = this.audio.error;
    if (!error) return;

    const mapped: PlaybackError = {
      code: this.mapErrorCode(error.code),
      message: error.message || "Unknown playback error",
      retriable: error.code === MediaError.MEDIA_ERR_NETWORK,
    };
    this.emit("error", mapped);
  };

  private mapErrorCode(
    code: number,
  ): PlaybackError["code"] {
    switch (code) {
      case MediaError.MEDIA_ERR_ABORTED:
        return "aborted";
      case MediaError.MEDIA_ERR_NETWORK:
        return "network";
      case MediaError.MEDIA_ERR_DECODE:
        return "decode";
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        return "src_not_supported";
      default:
        return "unknown";
    }
  }

  private setupAudioContext(): void {
    if (this.audioContext) return;

    try {
      this.audioContext = new AudioContext();
      this.audioContext.onstatechange = () => {
        if (!this.audioContext) return;
        if (
          this.audioContext.state === "suspended" &&
          typeof document !== "undefined" &&
          !document.hidden
        ) {
          if (this.resumeDebounce) return;
          this.resumeDebounce = setTimeout(() => {
            this.resumeDebounce = null;
          }, 1000);
          this.audioContext.resume().catch(() => {});
        }
      };

      this.sourceNode = this.audioContext.createMediaElementSource(
        this.audio,
      );
      this.gainNode = this.audioContext.createGain();
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
    } catch {
      this.teardownAudioContext();
    }
  }

  private teardownAudioContext(): void {
    if (this.resumeDebounce) {
      clearTimeout(this.resumeDebounce);
      this.resumeDebounce = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  private async resumeAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.setupAudioContext();
    }
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }
}
