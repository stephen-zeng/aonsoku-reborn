import { getCoverArtUrl } from "@/api/httpClient";
import { coverArtCache, getCurrentScope } from "@/lib/cache/cover-art-cache";
import { usePlayerStore } from "@/store/player.store";
import { ISong } from "@/types/responses/song";
import { LanControlMessageType } from "@/types/lanControl";

const MEDIA_SESSION_COVER_SIZE = "300";

/**
 * Check if MediaSession API is supported and available
 */
function isMediaSessionSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    navigator.mediaSession !== null
  );
}

/**
 * Log MediaSession related information for debugging
 */
function logMediaSessionInfo(action: string, data?: unknown): void {
  if (!isMediaSessionSupported()) {
    console.warn(`[MediaSession] ${action}: API not supported`);
    return;
  }
  console.log(`[MediaSession] ${action}:`, data);
}

function removeMediaSession() {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.metadata = null;
    logMediaSessionInfo("Removed metadata");
  } catch (error) {
    console.error("[MediaSession] Failed to remove metadata:", error);
  }
}

function setMediaSession(
  song:
    | ISong
    | {
        title: string;
        artist: string;
        album: string;
        coverArt?: string;
        duration?: number;
      },
) {
  if (!isMediaSessionSupported()) {
    console.warn("[MediaSession] navigator.mediaSession not available");
    return;
  }

  async function buildArtwork(): Promise<{
    artwork: MediaImage[];
    blobUrl: string | null;
  }> {
    if (!song.coverArt) return { artwork: [], blobUrl: null };

    // Prefer cached blob URL; fall back to live server URL if not cached
    const scope = getCurrentScope();
    const blob = await coverArtCache.getBlob(
      scope,
      song.coverArt,
      MEDIA_SESSION_COVER_SIZE,
    );
    const blobUrl = blob ? URL.createObjectURL(blob) : null;
    const src =
      blobUrl ?? getCoverArtUrl(song.coverArt, "song", MEDIA_SESSION_COVER_SIZE);

    return {
      artwork: [
        {
          src,
          sizes: `${MEDIA_SESSION_COVER_SIZE}x${MEDIA_SESSION_COVER_SIZE}`,
          type: "image/jpeg",
        },
      ],
      blobUrl,
    };
  }

  buildArtwork()
    .then(({ artwork, blobUrl }) => {
      try {
        const metadata = {
          title: song.title || "Unknown Title",
          artist: song.artist || "Unknown Artist",
          album: song.album || "Unknown Album",
          artwork,
        };

        logMediaSessionInfo("Setting metadata", {
          title: metadata.title,
          artist: metadata.artist,
          album: metadata.album,
          hasArtwork: artwork.length > 0,
        });

        navigator.mediaSession.metadata = new MediaMetadata(metadata);

        // Revoke the temporary blob URL — MediaMetadata has consumed it
        if (blobUrl) URL.revokeObjectURL(blobUrl);

        if (navigator.mediaSession.metadata === null) {
          console.warn("[MediaSession] Metadata was set to null unexpectedly");
        }
      } catch (error) {
        // Revoke blob URL even if setting metadata threw
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        console.error("[MediaSession] Failed to set metadata:", error);
      }
    })
    .catch((error) => {
      console.error("[MediaSession] Failed to build artwork:", error);
    });
}

async function setRadioMediaSession(label: string, radioName: string) {
  if (!isMediaSessionSupported()) return;

  try {
    const metadata = {
      title: radioName || "Unknown Radio",
      artist: label || "Radio",
      album: "",
      artwork: [],
    };

    logMediaSessionInfo("Setting radio metadata", metadata);
    navigator.mediaSession.metadata = new MediaMetadata(metadata);
  } catch (error) {
    console.error("[MediaSession] Failed to set radio metadata:", error);
  }
}

function setPlaybackState(state: boolean | null) {
  if (!isMediaSessionSupported()) return;

  try {
    let newState: MediaSessionPlaybackState = "none";
    if (state === null) {
      newState = "none";
    } else if (state) {
      newState = "playing";
    } else {
      newState = "paused";
    }

    logMediaSessionInfo("Setting playback state", newState);
    navigator.mediaSession.playbackState = newState;

    // Verify that playback state was actually set
    if (navigator.mediaSession.playbackState !== newState) {
      console.warn(
        "[MediaSession] Playback state mismatch:",
        "expected",
        newState,
        "got",
        navigator.mediaSession.playbackState,
      );
    }
  } catch (error) {
    console.error("[MediaSession] Failed to set playback state:", error);
  }
}

function setPositionState(
  duration: number,
  position: number,
  playbackRate = 1.0,
) {
  if (!isMediaSessionSupported()) return;

  // Validate inputs
  if (typeof duration !== "number" || duration < 0) {
    console.warn("[MediaSession] Invalid duration:", duration);
    return;
  }
  if (typeof position !== "number" || position < 0) {
    console.warn("[MediaSession] Invalid position:", position);
    return;
  }
  if (position > duration) {
    console.warn(
      "[MediaSession] Position exceeds duration:",
      position,
      ">",
      duration,
    );
    position = duration;
  }

  try {
    navigator.mediaSession.setPositionState({
      duration: duration,
      playbackRate: playbackRate,
      position: position,
    });
    logMediaSessionInfo("Set position state", {
      duration,
      position,
      playbackRate,
    });
  } catch (error) {
    // Position state might not be supported on all browsers
    console.warn("[MediaSession] Failed to set position state:", error);
  }
}

function setHandlers() {
  if (!isMediaSessionSupported()) {
    console.warn("[MediaSession] Cannot set handlers: API not supported");
    return;
  }

  const { mediaSession } = navigator;

  try {
    const state = usePlayerStore.getState();
    const { togglePlayPause, playNextSong, playPrevSong, setProgress } =
      state.actions;
    const isRemoteActive = state.remoteControl.active;
    const remoteSender = state.remoteControl.sendCommand;

    logMediaSessionInfo("Setting up action handlers", {
      isRemoteActive,
      hasRemoteSender: !!remoteSender,
    });

    // Clear previous handlers
    mediaSession.setActionHandler("seekbackward", null);
    mediaSession.setActionHandler("seekforward", null);

    // Play/Pause handler
    mediaSession.setActionHandler("play", () => {
      console.log("[MediaSession] Play action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.PLAY);
      } else {
        togglePlayPause();
      }
    });

    mediaSession.setActionHandler("pause", () => {
      console.log("[MediaSession] Pause action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.PAUSE);
      } else {
        togglePlayPause();
      }
    });

    // Previous track handler
    mediaSession.setActionHandler("previoustrack", () => {
      console.log("[MediaSession] Previous track action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.PREVIOUS);
      } else {
        playPrevSong();
      }
    });

    // Next track handler
    mediaSession.setActionHandler("nexttrack", () => {
      console.log("[MediaSession] Next track action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.NEXT);
      } else {
        playNextSong();
      }
    });

    // Seek handler
    mediaSession.setActionHandler("seekto", (details) => {
      console.log("[MediaSession] Seek action triggered:", details);
      if (details.seekTime !== undefined) {
        if (isRemoteActive && remoteSender) {
          remoteSender(LanControlMessageType.SEEK, {
            time: details.seekTime,
          });
        } else {
          const audioPlayerRef = state.playerState.audioPlayerRef;
          if (audioPlayerRef) {
            audioPlayerRef.currentTime = details.seekTime;
            setProgress(Math.floor(details.seekTime));
          }
        }
      }
    });

    console.log("[MediaSession] All action handlers set successfully");
  } catch (error) {
    console.error("[MediaSession] Failed to set action handlers:", error);
  }
}

export const manageMediaSession = {
  removeMediaSession,
  setMediaSession,
  setRadioMediaSession,
  setPlaybackState,
  setPositionState,
  setHandlers,
};
