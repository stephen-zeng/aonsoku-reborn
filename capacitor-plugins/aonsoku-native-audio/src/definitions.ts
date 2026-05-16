import type { PluginListenerHandle } from "@capacitor/core";

export interface SetSrcOptions {
  url: string;
  songId: string;
  headers?: Record<string, string>;
}

export interface SeekOptions {
  time: number;
}

export interface VolumeOptions {
  volume: number;
}

export interface ReplayGainOptions {
  gain: number;
  enabled: boolean;
}

export interface MediaMetadataOptions {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
  duration?: number;
}

export interface PlaybackState {
  currentTime: number;
  duration: number;
  paused: boolean;
  buffered: number;
}

export interface TimeUpdateEvent {
  currentTime: number;
  duration: number;
}

export interface BufferedProgressEvent {
  buffered: number;
}

export interface PlaybackStateChangedEvent {
  state: "playing" | "paused" | "stopped" | "buffering";
}

export interface PlaybackErrorEvent {
  code: string;
  message: string;
}

export interface MediaSessionActionEvent {
  action: string;
  seekTime?: number;
}

export interface NativeAudioPlugin {
  setSrc(options: SetSrcOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(options: SeekOptions): Promise<void>;
  stop(): Promise<void>;

  setVolume(options: VolumeOptions): Promise<void>;
  setReplayGain(options: ReplayGainOptions): Promise<void>;

  getState(): Promise<PlaybackState>;

  setMediaMetadata(options: MediaMetadataOptions): Promise<void>;

  preload(options: SetSrcOptions): Promise<void>;

  addListener(
    eventName: "playbackStateChanged",
    handler: (data: PlaybackStateChangedEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "timeUpdate",
    handler: (data: TimeUpdateEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "bufferedProgress",
    handler: (data: BufferedProgressEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "playbackEnded",
    handler: () => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "playbackError",
    handler: (data: PlaybackErrorEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "mediaSessionAction",
    handler: (data: MediaSessionActionEvent) => void,
  ): Promise<PluginListenerHandle>;
}
