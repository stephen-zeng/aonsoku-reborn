export interface MediaSessionSongData {
  title: string;
  artist: string;
  album: string;
  coverArtUrl?: string;
  duration?: number;
}

export interface MediaSessionHandlers {
  play: () => void;
  pause: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  seekTo: (time: number) => void;
  stop: () => void;
}

export interface MediaSessionAdapter {
  setMetadata(song: MediaSessionSongData): Promise<void>;
  setPlaybackState(state: "playing" | "paused" | "none"): void;
  setPositionState(
    duration: number,
    position: number,
    playbackRate?: number,
  ): void;
  setHandlers(handlers: MediaSessionHandlers): void;
  removeMetadata(): void;
  destroy(): void;
}
