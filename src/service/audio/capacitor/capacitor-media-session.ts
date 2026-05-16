import type { NativeAudioPlugin } from "aonsoku-native-audio";
import type {
  MediaSessionAdapter,
  MediaSessionHandlers,
  MediaSessionSongData,
} from "../media-session-types";

export class CapacitorMediaSession implements MediaSessionAdapter {
  private plugin: NativeAudioPlugin;
  private handlers: MediaSessionHandlers | null = null;

  constructor(plugin: NativeAudioPlugin) {
    this.plugin = plugin;
  }

  async initialize(): Promise<void> {
    await this.plugin.addListener("mediaSessionAction", (data) => {
      if (!this.handlers) return;
      switch (data.action) {
        case "play":
          this.handlers.play();
          break;
        case "pause":
          this.handlers.pause();
          break;
        case "nextTrack":
          this.handlers.nextTrack();
          break;
        case "previousTrack":
          this.handlers.previousTrack();
          break;
        case "seekTo":
          if (data.seekTime !== undefined) {
            this.handlers.seekTo(data.seekTime);
          }
          break;
        case "stop":
          this.handlers.stop();
          break;
      }
    });
  }

  async setMetadata(song: MediaSessionSongData): Promise<void> {
    await this.plugin.setMediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album,
      artworkUrl: song.coverArtUrl,
      duration: song.duration,
    });
  }

  setPlaybackState(_state: "playing" | "paused" | "none"): void {
    // Native side manages playback state via MPNowPlayingInfoCenter
  }

  setPositionState(
    _duration: number,
    _position: number,
    _playbackRate?: number,
  ): void {
    // Native side updates position via periodic time observer
  }

  setHandlers(handlers: MediaSessionHandlers): void {
    this.handlers = handlers;
  }

  removeMetadata(): void {
    // Native side clears when stop() is called
  }

  destroy(): void {
    this.handlers = null;
  }
}
