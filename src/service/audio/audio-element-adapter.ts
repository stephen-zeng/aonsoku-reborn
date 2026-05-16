import type { PlaybackEngine, PlaybackEngineEvents, ReplayGainConfig } from "./types";

type EventMap = PlaybackEngineEvents;

/**
 * Wraps an existing HTMLAudioElement as a PlaybackEngine.
 * Used as a bridge while the AudioPlayer component still manages
 * its own <audio> element directly.
 */
export class AudioElementAdapter implements PlaybackEngine {
  readonly element: HTMLAudioElement;

  constructor(audio: HTMLAudioElement) {
    this.element = audio;
  }

  async initialize(): Promise<void> {}
  destroy(): void {}

  setSrc(url: string, _songId: string): void {
    this.element.src = url;
  }

  clearSrc(): void {
    this.element.removeAttribute("src");
    this.element.load();
  }

  async play(): Promise<void> {
    await this.element.play();
  }

  pause(): void {
    this.element.pause();
  }

  seek(time: number): void {
    this.element.currentTime = time;
  }

  setVolume(volume: number): void {
    this.element.volume = volume;
  }

  setReplayGain(_config: ReplayGainConfig | null): void {}

  getCurrentTime(): number {
    return this.element.currentTime;
  }

  getDuration(): number {
    return this.element.duration || 0;
  }

  isPaused(): boolean {
    return this.element.paused;
  }

  isEnded(): boolean {
    return this.element.ended;
  }

  hasSrc(): boolean {
    return !!this.element.src && this.element.src !== "";
  }

  getReadyState(): number {
    return this.element.readyState;
  }

  on<K extends keyof EventMap>(_event: K, _handler: EventMap[K]): void {}
  off<K extends keyof EventMap>(_event: K, _handler: EventMap[K]): void {}
}
