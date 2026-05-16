export interface PlaybackEngineEvents {
  play: () => void;
  pause: () => void;
  ended: () => void;
  timeUpdate: (currentTime: number) => void;
  durationChange: (duration: number) => void;
  bufferedProgress: (buffered: number) => void;
  waiting: () => void;
  playing: () => void;
  canPlay: () => void;
  seeked: () => void;
  error: (error: PlaybackError) => void;
}

export interface PlaybackError {
  code: "aborted" | "network" | "decode" | "src_not_supported" | "unknown";
  message: string;
  retriable: boolean;
}

export interface ReplayGainConfig {
  gainValue: number;
  enabled: boolean;
}

export interface PlaybackEngine {
  initialize(): Promise<void>;
  destroy(): void;

  setSrc(url: string, songId: string): void;
  clearSrc(): void;

  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;

  setVolume(volume: number): void;
  setReplayGain(config: ReplayGainConfig | null): void;

  getCurrentTime(): number;
  getDuration(): number;
  isPaused(): boolean;
  isEnded(): boolean;
  hasSrc(): boolean;
  getReadyState(): number;

  on<K extends keyof PlaybackEngineEvents>(
    event: K,
    handler: PlaybackEngineEvents[K],
  ): void;
  off<K extends keyof PlaybackEngineEvents>(
    event: K,
    handler: PlaybackEngineEvents[K],
  ): void;

  preload?(url: string, songId: string): void;
}
