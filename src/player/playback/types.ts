import { LoopState } from "@/types/playerContext";

export type PlaybackSource =
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

export interface PlaybackProgressEvent {
  currentTime: number;
  duration: number;
  bufferedTime: number;
}

export interface PlaybackDurationEvent {
  duration: number;
}

export interface PlaybackBufferingEvent {
  isBuffering: boolean;
}

export interface PlaybackMetadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  artworkUrl?: string;
}

export interface PlaybackErrorEvent {
  error: unknown;
  code?: number | string;
  message?: string;
}

export type PlaybackRemoteCommand =
  | "play"
  | "pause"
  | "togglePlayPause"
  | "next"
  | "previous"
  | "seek";

export interface PlaybackRemoteCommandEvent {
  command: PlaybackRemoteCommand;
  position?: number;
}

export interface PlaybackBackendEvents {
  progress: PlaybackProgressEvent;
  duration: PlaybackDurationEvent;
  buffering: PlaybackBufferingEvent;
  ended: void;
  play: void;
  pause: void;
  error: PlaybackErrorEvent;
  remoteCommand: PlaybackRemoteCommandEvent;
}

export type PlaybackBackendEvent = keyof PlaybackBackendEvents;

export type PlaybackBackendListener<TEvent extends PlaybackBackendEvent> = (
  event: PlaybackBackendEvents[TEvent],
) => void;

export type UnsubscribePlaybackEvent = () => void;

export type PlaybackRepeatMode = "off" | "one" | "all";

export interface PlaybackBackend {
  load(
    source: PlaybackSource,
    metadata?: PlaybackMetadata,
  ): void | Promise<void>;
  play(): Promise<void>;
  pause(): void | Promise<void>;
  stop(): void | Promise<void>;
  seek(seconds: number): void | Promise<void>;
  setLoop(enabled: boolean): void | Promise<void>;
  setRepeatMode(mode: PlaybackRepeatMode): void | Promise<void>;
  setShuffle(enabled: boolean): void | Promise<void>;
  skipToNext(): void | Promise<void>;
  skipToPrevious(): void | Promise<void>;
  setVolume(value: number): void | Promise<void>;
  updateMetadata(metadata: PlaybackMetadata): void | Promise<void>;
  preload(source: PlaybackSource): void | Promise<void>;
  dispose(): void;
  subscribe<TEvent extends PlaybackBackendEvent>(
    event: TEvent,
    listener: PlaybackBackendListener<TEvent>,
  ): UnsubscribePlaybackEvent;
}

export function getPlaybackSourceUrl(source: PlaybackSource) {
  return source.kind === "native-file" ? source.uri : source.url;
}

export function createUrlPlaybackSource(
  url: string,
  options: {
    kind?: "stream" | "blob" | "radio";
    songId?: string;
    radioId?: string;
  } = {},
): PlaybackSource {
  const kind = options.kind ?? (url.startsWith("blob:") ? "blob" : "stream");

  if (kind === "radio") {
    return { kind, url, radioId: options.radioId };
  }

  return { kind, url, songId: options.songId };
}

export function playbackRepeatModeFromLoopState(
  loopState: LoopState,
): PlaybackRepeatMode {
  switch (loopState) {
    case LoopState.All:
      return "all";
    case LoopState.One:
      return "one";
    case LoopState.Off:
      return "off";
  }
}
