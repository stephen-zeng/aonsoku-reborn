import { usePlayerStore } from "@/store/player.store";
import { LanControlMessageType } from "@/types/lanControl";
import { ISong } from "@/types/responses/song";
import { cacheManager } from "@/service/cache";
import { getCoverArtUrlFromSongPreference, resolveCacheKeys } from "./coverArt";
import { isValidDuration } from "./duration";
import { logger } from "./logger";

const MEDIA_SESSION_COVER_SIZE = "300";
const REMOVE_DEBOUNCE_MS = 500;

function isMediaSessionSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    navigator.mediaSession !== null
  );
}

let lastArtworkUrl: string | null = null;
let currentSessionId = 0;
let removeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function removeMediaSession() {
  if (!isMediaSessionSupported()) return;

  if (removeDebounceTimer) {
    clearTimeout(removeDebounceTimer);
    removeDebounceTimer = null;
  }

  removeDebounceTimer = setTimeout(() => {
    removeDebounceTimer = null;
    try {
      navigator.mediaSession.metadata = null;
      if (lastArtworkUrl) {
        URL.revokeObjectURL(lastArtworkUrl);
        lastArtworkUrl = null;
      }
      logger.info("[MediaSession] Removed metadata (debounced)");
    } catch (error) {
      logger.error("[MediaSession] Failed to remove metadata:", error);
    }
  }, REMOVE_DEBOUNCE_MS);
}

function cancelRemoveDebounce() {
  if (removeDebounceTimer) {
    clearTimeout(removeDebounceTimer);
    removeDebounceTimer = null;
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

  cancelRemoveDebounce();

  currentSessionId++;
  const sessionId = currentSessionId;

  const basicMetadata = {
    title: song.title || "Unknown Title",
    artist: song.artist || "Unknown Artist",
    album: song.album || "Unknown Album",
    artwork: [] as MediaImage[],
  };

  try {
    navigator.mediaSession.metadata = new MediaMetadata(basicMetadata);
    logger.info("[MediaSession] Set basic metadata immediately", {
      title: basicMetadata.title,
      artist: basicMetadata.artist,
      album: basicMetadata.album,
    });

    ensurePlaybackStatePlaying();
  } catch (error) {
    logger.error("[MediaSession] Failed to set basic metadata:", error);
  }

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

    logger.info("[MediaSession] Setting metadata with artwork", {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      hasArtwork: artwork.length > 0,
    });

    navigator.mediaSession.metadata = new MediaMetadata(metadata);

    ensurePlaybackStatePlaying();

    if (navigator.mediaSession.metadata === null) {
      logger.info("[MediaSession] Metadata was set to null unexpectedly");
    }
  } catch (error) {
    logger.error("[MediaSession] Failed to set metadata:", error);
  }
}

async function setRadioMediaSession(label: string, radioName: string) {
  if (!isMediaSessionSupported()) return;

  cancelRemoveDebounce();

  try {
    const metadata = {
      title: radioName || "Unknown Radio",
      artist: label || "Radio",
      album: "",
      artwork: [],
    };

    logger.info("[MediaSession] Setting radio metadata", metadata);
    navigator.mediaSession.metadata = new MediaMetadata(metadata);

    ensurePlaybackStatePlaying();
  } catch (error) {
    logger.error("[MediaSession] Failed to set radio metadata:", error);
  }
}

function ensurePlaybackStatePlaying() {
  if (!isMediaSessionSupported()) return;
  if (navigator.mediaSession.playbackState !== "playing") {
    navigator.mediaSession.playbackState = "playing";
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
    logger.info("[MediaSession] Setting up action handlers");

    mediaSession.setActionHandler("seekbackward", null);
    mediaSession.setActionHandler("seekforward", null);

    mediaSession.setActionHandler("stop", () => {
      logger.info("[MediaSession] Stop action triggered");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PAUSE);
        state.remoteControl.sendCommand(LanControlMessageType.CLEAR_QUEUE);
      } else {
        state.actions.clearPlayerState();
      }
    });

    mediaSession.setActionHandler("play", () => {
      logger.info("[MediaSession] Play action triggered");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PLAY);
      } else {
        state.actions.togglePlayPause();
      }
    });

    mediaSession.setActionHandler("pause", () => {
      logger.info("[MediaSession] Pause action triggered");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PAUSE);
      } else {
        state.actions.togglePlayPause();
      }
    });

    mediaSession.setActionHandler("previoustrack", () => {
      logger.info("[MediaSession] Previous track action triggered");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PREVIOUS);
      } else {
        state.actions.playPrevSong();
      }
    });

    mediaSession.setActionHandler("nexttrack", () => {
      logger.info("[MediaSession] Next track action triggered");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.NEXT);
      } else {
        state.actions.playNextSong();
      }
    });

    mediaSession.setActionHandler("seekto", (details) => {
      logger.info("[MediaSession] Seek action triggered:", details);
      if (details.seekTime !== undefined) {
        const state = usePlayerStore.getState();
        if (state.remoteControl.active && state.remoteControl.sendCommand) {
          state.remoteControl.sendCommand(LanControlMessageType.SEEK, {
            time: details.seekTime,
          });
        } else {
          const audioPlayerRef = state.playerState.audioPlayerRef;
          if (audioPlayerRef) {
            audioPlayerRef.currentTime = details.seekTime;
            state.actions.setProgress(Math.floor(details.seekTime));
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
  ensurePlaybackStatePlaying,
  setPositionState,
  setHandlers,
};