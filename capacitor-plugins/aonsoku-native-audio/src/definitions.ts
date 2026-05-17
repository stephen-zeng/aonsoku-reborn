import type { Plugin, PluginListenerHandle } from "@capacitor/core";

export const NATIVE_AUDIO_PLUGIN_NAME = "AonsokuNativeAudio";

export type NativeAudioSource =
  | {
      kind: "stream";
      url: string;
      songId?: string;
    }
  | {
      kind: "blob";
      url: string;
      songId?: string;
    }
  | {
      kind: "native-file";
      uri: string;
      songId?: string;
    }
  | {
      kind: "radio";
      url: string;
      radioId?: string;
    };

export interface NativeAudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  artworkUrl?: string;
}

export interface NativeAudioLoadOptions {
  source: NativeAudioSource;
  metadata?: NativeAudioMetadata;
  autoplay?: boolean;
  startTime?: number;
}

export interface NativeAudioSeekOptions {
  position: number;
}

export interface NativeAudioRepeatModeOptions {
  mode: "off" | "one" | "all";
}

export interface NativeAudioShuffleOptions {
  enabled: boolean;
}

export interface NativeAudioQueueItem {
  source: NativeAudioSource;
  metadata?: NativeAudioMetadata;
}

export interface NativeAudioQueueOptions {
  items: NativeAudioQueueItem[];
  index: number;
}

export interface NativeAudioCachedAudioFile {
  songId: string;
  uri: string;
  contentType?: string;
  sizeBytes?: number;
  lastModifiedAt?: number;
}

export interface NativeAudioStoreFileOptions {
  songId: string;
  dataBase64: string;
  contentType: string;
}

export interface NativeAudioFileOptions {
  songId: string;
}

export interface NativeAudioResolveFileResult {
  file: NativeAudioCachedAudioFile | null;
}

export interface NativeAudioFileSizeResult {
  sizeBytes: number | null;
}

export interface NativeAudioDeleteFileResult {
  deleted: boolean;
}

export interface NativeAudioClearFilesResult {
  deletedCount: number;
}

export interface NativeAudioPlaybackStateChangedEvent {
  state:
    | "idle"
    | "loading"
    | "playing"
    | "paused"
    | "stopped"
    | "ended"
    | "failed";
}

export interface NativeAudioProgressEvent {
  currentTime: number;
  duration: number;
  bufferedTime?: number;
}

export interface NativeAudioDurationChangedEvent {
  duration: number;
}

export interface NativeAudioBufferingChangedEvent {
  isBuffering: boolean;
}

export interface NativeAudioEndedEvent {
  reason?: "finished" | "stopped";
}

export interface NativeAudioErrorEvent {
  code?: string;
  message: string;
}

export type NativeAudioRemoteCommand =
  | "play"
  | "pause"
  | "togglePlayPause"
  | "next"
  | "previous"
  | "seek";

export interface NativeAudioRemoteCommandEvent {
  command: NativeAudioRemoteCommand;
  position?: number;
}

export interface NativeAudioInterruptionChangedEvent {
  type: "began" | "ended";
  shouldResume?: boolean;
}

export interface NativeAudioRouteChangedEvent {
  reason?: string;
}

export interface NativeAudioEvents {
  playbackStateChanged: NativeAudioPlaybackStateChangedEvent;
  progress: NativeAudioProgressEvent;
  durationChanged: NativeAudioDurationChangedEvent;
  bufferingChanged: NativeAudioBufferingChangedEvent;
  ended: NativeAudioEndedEvent;
  error: NativeAudioErrorEvent;
  remoteCommand: NativeAudioRemoteCommandEvent;
  interruptionChanged: NativeAudioInterruptionChangedEvent;
  routeChanged: NativeAudioRouteChangedEvent;
}

export type NativeAudioEventName = keyof NativeAudioEvents;

export interface AonsokuNativeAudioPlugin extends Plugin {
  load(options: NativeAudioLoadOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(options: NativeAudioSeekOptions): Promise<void>;
  setRepeatMode(options: NativeAudioRepeatModeOptions): Promise<void>;
  setShuffle(options: NativeAudioShuffleOptions): Promise<void>;
  setQueue(options: NativeAudioQueueOptions): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  updateMetadata(metadata: NativeAudioMetadata): Promise<void>;
  preload(options: { source: NativeAudioSource }): Promise<void>;
  clear(): Promise<void>;
  storeAudioFile(
    options: NativeAudioStoreFileOptions,
  ): Promise<NativeAudioCachedAudioFile>;
  resolveAudioFile(
    options: NativeAudioFileOptions,
  ): Promise<NativeAudioResolveFileResult>;
  getAudioFileSize(
    options: NativeAudioFileOptions,
  ): Promise<NativeAudioFileSizeResult>;
  deleteAudioFile(
    options: NativeAudioFileOptions,
  ): Promise<NativeAudioDeleteFileResult>;
  clearAudioFiles(): Promise<NativeAudioClearFilesResult>;
  addListener<TEvent extends NativeAudioEventName>(
    eventName: TEvent,
    listenerFunc: (event: NativeAudioEvents[TEvent]) => void,
  ): Promise<PluginListenerHandle>;
}
