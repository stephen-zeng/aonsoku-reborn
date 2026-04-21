import { usePlayerStore } from "@/store/player.store";
import { LanControlMessageType } from "@/types/lanControl";
import { ISong } from "@/types/responses/song";
import { cacheManager } from "@/service/cache";
import { getCoverArtUrlFromSongPreference, resolveCacheKeys } from "./coverArt";
import { isValidDuration } from "./duration";
import { logger } from "./logger";

const MEDIA_SESSION_COVER_SIZE = "300";

function isMediaSessionSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    navigator.mediaSession !== null
  );
}

let lastArtworkUrl: string | null = null;
let currentSessionId = 0;

function removeMediaSession() {
  if (!isMediaSessionSupported()) return;

  try {
    navigator.mediaSession.metadata = null;
    if (lastArtworkUrl) {
      URL.revokeObjectURL(lastArtworkUrl);
      lastArtworkUrl = null;
    }
    logger.info("[MediaSession] Removed metadata");
  } catch (error) {
    logger.error("[MediaSession] Failed to remove metadata:", error);
  }
}

async function setMediaSession(
  song:
    | ISong
    | {
        title: string;
        artist: string;
        album: string;
        coverArt?: string;
        albumId?: string;
        duration?: number;
      },
) {
  if (!isMediaSessionSupported()) {
    logger.info("[MediaSession] navigator.mediaSession not available");
    return;
  }

  currentSessionId++;
  const sessionId = currentSessionId;

  async function buildArtwork(): Promise<{ artwork: MediaImage[] }> {
    if (!song.coverArt && !song.albumId) return { artwork: [] };

    if (lastArtworkUrl) {
      URL.revokeObjectURL(lastArtworkUrl);
      lastArtworkUrl = null;
    }

    let src = getCoverArtUrlFromSongPreference({
      coverArt: song.coverArt,
      coverArtType: "song",
      albumId: song.albumId,
      size: MEDIA_SESSION_COVER_SIZE,
    });

    const cacheKeys = resolveCacheKeys(song.coverArt, "song", song.albumId);
    for (const key of cacheKeys) {
      try {
        const cachedUrl = await cacheManager.getCachedCoverUrl(key);
        if (cachedUrl) {
          src = cachedUrl;
          lastArtworkUrl = cachedUrl;
          break;
        }
      } catch {
        // ignore and try next key
      }
    }

    return {
      artwork: [
        {
          src,
          sizes: `${MEDIA_SESSION_COVER_SIZE}x${MEDIA_SESSION_COVER_SIZE}`,
          type: "image/jpeg",
        },
      ],
    };
  }

  try {
    const { artwork } = await buildArtwork();

    if (sessionId !== currentSessionId) {
      logger.info("[MediaSession] Aborting outdated metadata update");
      return;
    }

    const metadata = {
      title: song.title || "Unknown Title",
      artist: song.artist || "Unknown Artist",
      album: song.album || "Unknown Album",
      artwork,
    };

    logger.info("[MediaSession] Setting metadata", {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      hasArtwork: artwork.length > 0,
    });

    navigator.mediaSession.metadata = new MediaMetadata(metadata);

    if (navigator.mediaSession.playbackState !== "playing") {
      navigator.mediaSession.playbackState = "playing";
    }

    if (navigator.mediaSession.metadata === null) {
      logger.info("[MediaSession] Metadata was set to null unexpectedly");
    }
  } catch (error) {
    logger.error("[MediaSession] Failed to set metadata:", error);
  }
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

    logger.info("[MediaSession] Setting radio metadata", metadata);
    navigator.mediaSession.metadata = new MediaMetadata(metadata);

    if (navigator.mediaSession.playbackState !== "playing") {
      navigator.mediaSession.playbackState = "playing";
    }
  } catch (error) {
    logger.error("[MediaSession] Failed to set radio metadata:", error);
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

    logger.info("[MediaSession] Setting playback state", newState);
    navigator.mediaSession.playbackState = newState;

    if (navigator.mediaSession.playbackState !== newState) {
      logger.info("[MediaSession] Playback state mismatch:", {
        expected: newState,
        actual: navigator.mediaSession.playbackState,
      });
    }
  } catch (error) {
    logger.error("[MediaSession] Failed to set playback state:", error);
  }
}

function setPositionState(
  duration: number,
  position: number,
  playbackRate = 1.0,
) {
  if (!isMediaSessionSupported()) return;

  if (!isValidDuration(duration)) {
    logger.info("[MediaSession] Invalid duration:", duration);
    return;
  }
  if (typeof position !== "number" || position < 0) {
    logger.info("[MediaSession] Invalid position:", position);
    return;
  }
  if (position > duration) {
    logger.info("[MediaSession] Position exceeds duration:", {
      position,
      duration,
    });
    position = duration;
  }

  try {
    navigator.mediaSession.setPositionState({
      duration: duration,
      playbackRate: playbackRate,
      position: position,
    });
    logger.info("[MediaSession] Set position state", {
      duration,
      position,
      playbackRate,
    });
  } catch (error) {
    logger.info("[MediaSession] Failed to set position state:", error);
  }
}

function setHandlers() {
  if (!isMediaSessionSupported()) {
    logger.info("[MediaSession] Cannot set handlers: API not supported");
    return;
  }

  const { mediaSession } = navigator;

  try {
    const state = usePlayerStore.getState();
    const { togglePlayPause, playNextSong, playPrevSong, setProgress } =
      state.actions;
    const isRemoteActive = state.remoteControl.active;
    const remoteSender = state.remoteControl.sendCommand;

    logger.info("[MediaSession] Setting up action handlers", {
      isRemoteActive,
      hasRemoteSender: !!remoteSender,
    });

    mediaSession.setActionHandler("seekbackward", null);
    mediaSession.setActionHandler("seekforward", null);

    mediaSession.setActionHandler("play", () => {
      logger.info("[MediaSession] Play action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.PLAY);
      } else {
        togglePlayPause();
      }
    });

    mediaSession.setActionHandler("pause", () => {
      logger.info("[MediaSession] Pause action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.PAUSE);
      } else {
        togglePlayPause();
      }
    });

    mediaSession.setActionHandler("previoustrack", () => {
      logger.info("[MediaSession] Previous track action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.PREVIOUS);
      } else {
        playPrevSong();
      }
    });

    mediaSession.setActionHandler("nexttrack", () => {
      logger.info("[MediaSession] Next track action triggered");
      if (isRemoteActive && remoteSender) {
        remoteSender(LanControlMessageType.NEXT);
      } else {
        playNextSong();
      }
    });

    mediaSession.setActionHandler("seekto", (details) => {
      logger.info("[MediaSession] Seek action triggered:", details);
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

    logger.info("[MediaSession] All action handlers set successfully");
  } catch (error) {
    logger.error("[MediaSession] Failed to set action handlers:", error);
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
