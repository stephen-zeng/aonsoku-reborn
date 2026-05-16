import type {
  MediaSessionAdapter,
  MediaSessionHandlers,
  MediaSessionSongData,
} from "../media-session-types";

function isSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    navigator.mediaSession !== null
  );
}

export class WebMediaSession implements MediaSessionAdapter {
  private lastArtworkUrl: string | null = null;
  private removeTimer: ReturnType<typeof setTimeout> | null = null;

  async setMetadata(song: MediaSessionSongData): Promise<void> {
    if (!isSupported()) return;

    this.cancelRemoveTimer();

    if (this.lastArtworkUrl) {
      URL.revokeObjectURL(this.lastArtworkUrl);
      this.lastArtworkUrl = null;
    }

    const artwork: MediaImage[] = [];
    if (song.coverArtUrl) {
      artwork.push({
        src: song.coverArtUrl,
        sizes: "300x300",
        type: "image/jpeg",
      });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title || "Unknown Title",
      artist: song.artist || "Unknown Artist",
      album: song.album || "Unknown Album",
      artwork,
    });
  }

  setPlaybackState(state: "playing" | "paused" | "none"): void {
    if (!isSupported()) return;
    navigator.mediaSession.playbackState = state;
  }

  setPositionState(
    duration: number,
    position: number,
    playbackRate = 1.0,
  ): void {
    if (!isSupported()) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    if (position < 0) return;

    const clampedPosition = Math.min(position, duration);

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position: clampedPosition,
      });
    } catch {
      // Some browsers throw on invalid state
    }
  }

  setHandlers(handlers: MediaSessionHandlers): void {
    if (!isSupported()) return;

    const { mediaSession } = navigator;

    mediaSession.setActionHandler("play", handlers.play);
    mediaSession.setActionHandler("pause", handlers.pause);
    mediaSession.setActionHandler("nexttrack", handlers.nextTrack);
    mediaSession.setActionHandler("previoustrack", handlers.previousTrack);
    mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        handlers.seekTo(details.seekTime);
      }
    });
    mediaSession.setActionHandler("stop", handlers.stop);
    mediaSession.setActionHandler("seekbackward", null);
    mediaSession.setActionHandler("seekforward", null);
  }

  removeMetadata(): void {
    if (!isSupported()) return;

    this.cancelRemoveTimer();
    this.removeTimer = setTimeout(() => {
      this.removeTimer = null;
      navigator.mediaSession.metadata = null;
      if (this.lastArtworkUrl) {
        URL.revokeObjectURL(this.lastArtworkUrl);
        this.lastArtworkUrl = null;
      }
    }, 500);
  }

  destroy(): void {
    this.cancelRemoveTimer();
    if (this.lastArtworkUrl) {
      URL.revokeObjectURL(this.lastArtworkUrl);
      this.lastArtworkUrl = null;
    }
  }

  private cancelRemoveTimer(): void {
    if (this.removeTimer) {
      clearTimeout(this.removeTimer);
      this.removeTimer = null;
    }
  }
}
