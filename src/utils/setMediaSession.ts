import { getNativeQueueController } from "@/player/queue-controller";
import { cacheManager } from "@/service/cache";
import { usePlayerStore } from "@/store/player.store";
import { LanControlMessageType } from "@/types/lanControl";
import { ISong } from "@/types/responses/song";
import { getCoverArtUrlFromSongPreference, resolveCacheKeys } from "./coverArt";
import { getRuntime } from "./capabilities";
import { isValidDuration } from "./duration";
import { logger } from "./logger";
import {
  clearTauriMediaSession,
  isTauriMediaSessionSupported,
  listenTauriMediaRemoteCommands,
  radioToTauriMediaSessionPayload,
  setTauriMediaSession,
  songToTauriMediaSessionPayload,
  type TauriMediaPlaybackState,
  type TauriMediaRemoteCommandEvent,
  type TauriMediaSessionPayload,
} from "./tauri-media-session";

const MEDIA_SESSION_COVER_SIZE = "300";
const REMOVE_DEBOUNCE_MS = 500;

function isMediaSessionSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  if (isTauriMediaSessionSupported()) return false;
  if (!("mediaSession" in navigator) || navigator.mediaSession === null)
    return false;
  // On Android and iOS native, the native MediaSession/MPNowPlayingInfoCenter
  // handles system-level controls. navigator.mediaSession would conflict with it.
  const runtime = getRuntime();
  if (runtime === "capacitor-android" || runtime === "capacitor-ios")
    return false;
  return true;
}

let lastArtworkUrl: string | null = null;
let currentSessionId = 0;
let removeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let tauriPlaybackState: TauriMediaPlaybackState = "none";
let tauriSessionPayload: TauriMediaSessionPayload | null = null;
let tauriRemoteCleanup: (() => void) | null = null;
let tauriRemoteListenerPending = false;

function updateTauriSession(payload: TauriMediaSessionPayload) {
  tauriSessionPayload = payload;
  setTauriMediaSession(payload);
}

function patchTauriSession(patch: Partial<TauriMediaSessionPayload>) {
  if (!tauriSessionPayload) return;

  updateTauriSession({
    ...tauriSessionPayload,
    ...patch,
    playbackState: patch.playbackState ?? tauriPlaybackState,
  });
}

function removeMediaSession() {
  if (isTauriMediaSessionSupported()) {
    tauriPlaybackState = "none";
    tauriSessionPayload = null;
    clearTauriMediaSession();
    return;
  }

  if (!isMediaSessionSupported()) return;

  const callStack = new Error().stack?.split("\n").slice(1, 4).join(" | ");
  logger.info(
    `[MediaSession.remove] sessionId=${currentSessionId} | stackTrace=${callStack}`,
  );

  if (removeDebounceTimer) {
    clearTimeout(removeDebounceTimer);
    removeDebounceTimer = null;
  }

  currentSessionId++;

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
  if (isTauriMediaSessionSupported()) {
    cancelRemoveDebounce();
    const playbackState =
      tauriPlaybackState === "none" ? "playing" : tauriPlaybackState;
    tauriPlaybackState = playbackState;
    updateTauriSession(songToTauriMediaSessionPayload(song, playbackState));
    return;
  }

  if (!isMediaSessionSupported()) {
    logger.info("[MediaSession] navigator.mediaSession not available");
    return;
  }

  cancelRemoveDebounce();

  currentSessionId++;
  const sessionId = currentSessionId;
  logger.info(
    `[MediaSession.set] songId=${(song as { id?: string }).id ?? song.title} | title="${song.title}" | artist="${song.artist}" | sessionId=${sessionId}`,
  );

  const title = song.title || "Unknown Title";
  const artist = song.artist || "Unknown Artist";
  const album = song.album || "Unknown Album";

  ensurePlaybackStatePlaying();

  if (!song.coverArt && !song.albumId) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [],
      });
      logger.info("[MediaSession] Set metadata (no artwork)", {
        title,
        artist,
        album,
      });
    } catch (error) {
      logger.error("[MediaSession] Failed to set metadata:", error);
    }
    return;
  }

  try {
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

    let artworkFromCache = false;

    const cacheKeys = resolveCacheKeys(song.coverArt, "song", song.albumId);
    for (const key of cacheKeys) {
      try {
        const cachedUrl = await cacheManager.getCachedCoverUrl(key);
        if (cachedUrl) {
          src = cachedUrl;
          lastArtworkUrl = cachedUrl;
          artworkFromCache = true;
          break;
        }
      } catch {
        // ignore and try next key
      }
    }

    if (sessionId !== currentSessionId) {
      logger.info("[MediaSession] Aborting outdated metadata update");
      if (artworkFromCache && lastArtworkUrl === src) {
        URL.revokeObjectURL(lastArtworkUrl);
        lastArtworkUrl = null;
      }
      return;
    }

    if (!artworkFromCache) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album,
          artwork: [],
        });
        logger.info("[MediaSession] Set basic metadata (artwork loading)", {
          title,
          artist,
          album,
        });
      } catch (error) {
        logger.error("[MediaSession] Failed to set basic metadata:", error);
      }
    }

    const metadata = {
      title,
      artist,
      album,
      artwork: [
        {
          src,
          sizes: `${MEDIA_SESSION_COVER_SIZE}x${MEDIA_SESSION_COVER_SIZE}`,
          type: "image/jpeg",
        },
      ],
    };

    logger.info("[MediaSession] Setting metadata with artwork", {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      fromCache: artworkFromCache,
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
  if (isTauriMediaSessionSupported()) {
    cancelRemoveDebounce();
    const playbackState =
      tauriPlaybackState === "none" ? "playing" : tauriPlaybackState;
    tauriPlaybackState = playbackState;
    updateTauriSession(
      radioToTauriMediaSessionPayload(label, radioName, playbackState),
    );
    return;
  }

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
  if (isTauriMediaSessionSupported()) {
    tauriPlaybackState = "playing";
    patchTauriSession({ playbackState: "playing" });
    return;
  }

  if (!isMediaSessionSupported()) return;
  const prevState = navigator.mediaSession.playbackState;
  const hadPendingRemove = !!removeDebounceTimer;
  cancelRemoveDebounce();
  if (prevState !== "playing") {
    navigator.mediaSession.playbackState = "playing";
  }
  logger.info(
    `[MediaSession.ensurePlaying] prevState=${prevState} → playing | cancelledRemove=${hadPendingRemove} | sessionId=${currentSessionId}`,
  );
}

function setPlaybackState(state: boolean | null) {
  if (isTauriMediaSessionSupported()) {
    tauriPlaybackState = state === null ? "none" : state ? "playing" : "paused";
    if (tauriPlaybackState === "none") {
      tauriSessionPayload = null;
      clearTauriMediaSession();
      return;
    }
    patchTauriSession({ playbackState: tauriPlaybackState });
    return;
  }

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

    const prevState = navigator.mediaSession.playbackState;
    logger.info(
      `[MediaSession.setPlaybackState] isPlaying=${state} | prevState=${prevState} → newState=${newState}`,
    );
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
  if (isTauriMediaSessionSupported()) {
    if (!isValidDuration(duration)) {
      logger.info("[MediaSession] Invalid duration:", duration);
      return;
    }
    if (typeof position !== "number" || position < 0) {
      logger.info("[MediaSession] Invalid position:", position);
      return;
    }
    patchTauriSession({
      duration,
      position: Math.min(position, duration),
      playbackState: tauriPlaybackState,
    });
    return;
  }

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
    logger.info(
      `[MediaSession.setPosition] duration=${duration} | position=${position} | playbackRate=${playbackRate} | clamped=${position > duration ? duration : position}`,
    );
  } catch (error) {
    logger.info(
      `[MediaSession.setPosition:ERROR] ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function handleTauriRemoteCommand(event: TauriMediaRemoteCommandEvent) {
  logger.info(`[TauriMediaSession.handler] action=${event.command}`);

  const state = usePlayerStore.getState();
  const { active, sendCommand } = state.remoteControl;

  switch (event.command) {
    case "play":
      if (active && sendCommand) {
        sendCommand(LanControlMessageType.PLAY);
      } else if (!state.playerState.isPlaying) {
        state.actions.setPlayingState(true);
      }
      return;
    case "pause":
      if (active && sendCommand) {
        sendCommand(LanControlMessageType.PAUSE);
      } else if (state.playerState.isPlaying) {
        state.actions.setPlayingState(false);
      }
      return;
    case "togglePlayPause":
      if (active && sendCommand) {
        sendCommand(LanControlMessageType.PLAY_PAUSE);
      } else {
        state.actions.togglePlayPause();
      }
      return;
    case "next":
      if (active && sendCommand) {
        sendCommand(LanControlMessageType.NEXT);
      } else {
        state.actions.playNextSong();
      }
      return;
    case "previous":
      if (active && sendCommand) {
        sendCommand(LanControlMessageType.PREVIOUS);
      } else {
        state.actions.playPrevSong();
      }
      return;
    case "seek": {
      const position = Math.max(0, event.position ?? 0);
      if (active && sendCommand) {
        sendCommand(LanControlMessageType.SEEK, { time: position });
        return;
      }

      const audioRef =
        state.playerState.mediaType === "radio"
          ? state.playerState.radioPlayerRef
          : state.playerState.audioPlayerRef;
      if (audioRef) {
        audioRef.currentTime = position;
      }
      state.actions.setProgress(Math.floor(position));
      return;
    }
    case "stop":
      if (active && sendCommand) {
        sendCommand(LanControlMessageType.PAUSE);
        sendCommand(LanControlMessageType.CLEAR_QUEUE);
      } else {
        state.actions.clearPlayerState();
      }
      return;
    case "like":
      state.actions.starCurrentSong();
      return;
    case "shuffle":
      state.actions.toggleShuffle();
      return;
  }
}

function setHandlers() {
  if (isTauriMediaSessionSupported()) {
    if (tauriRemoteCleanup || tauriRemoteListenerPending) return;

    tauriRemoteListenerPending = true;
    listenTauriMediaRemoteCommands(handleTauriRemoteCommand)
      .then((cleanup) => {
        tauriRemoteCleanup = cleanup;
      })
      .catch((error) => {
        logger.error(
          "[TauriMediaSession] Failed to set remote handlers",
          error,
        );
      })
      .finally(() => {
        tauriRemoteListenerPending = false;
      });
    return;
  }

  if (!isMediaSessionSupported()) {
    logger.info("[MediaSession] Cannot set handlers: API not supported");
    return;
  }

  const { mediaSession } = navigator;
  const isRemote = usePlayerStore.getState().remoteControl.active;
  logger.info(`[MediaSession.setHandlers] remoteControl=${isRemote}`);

  try {
    logger.info("[MediaSession] Setting up action handlers");

    // Disabled intentionally: on iOS, these handlers override the track
    // skip buttons (previoustrack/nexttrack) on lock screen and Control
    // Center, making it impossible to skip tracks. Leave as null to
    // preserve skip functionality.
    mediaSession.setActionHandler("seekbackward", null);
    mediaSession.setActionHandler("seekforward", null);

    mediaSession.setActionHandler("stop", () => {
      logger.info("[MediaSession.handler] action=stop");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PAUSE);
        state.remoteControl.sendCommand(LanControlMessageType.CLEAR_QUEUE);
      } else {
        state.actions.clearPlayerState();
      }
    });

    mediaSession.setActionHandler("play", () => {
      logger.info("[MediaSession.handler] action=play");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PLAY);
      } else if (!state.playerState.isPlaying) {
        state.actions.setPlayingState(true);
      }
    });

    mediaSession.setActionHandler("pause", () => {
      logger.info("[MediaSession.handler] action=pause");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PAUSE);
      } else if (state.playerState.isPlaying) {
        state.actions.setPlayingState(false);
      }
    });

    mediaSession.setActionHandler("previoustrack", () => {
      logger.info("[MediaSession.handler] action=previoustrack");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.PREVIOUS);
      } else {
        state.actions.playPrevSong();
      }
    });

    mediaSession.setActionHandler("nexttrack", () => {
      logger.info("[MediaSession.handler] action=nexttrack");
      const state = usePlayerStore.getState();
      if (state.remoteControl.active && state.remoteControl.sendCommand) {
        state.remoteControl.sendCommand(LanControlMessageType.NEXT);
      } else {
        state.actions.playNextSong();
      }
    });

    mediaSession.setActionHandler("seekto", (details) => {
      logger.info(
        `[MediaSession.handler] action=seekto | seekTime=${details.seekTime}`,
      );
      if (details.seekTime !== undefined) {
        const state = usePlayerStore.getState();
        if (state.remoteControl.active && state.remoteControl.sendCommand) {
          state.remoteControl.sendCommand(LanControlMessageType.SEEK, {
            time: details.seekTime,
          });
          return;
        }
        const nativeController = getNativeQueueController();
        if (nativeController) {
          nativeController.seek(details.seekTime);
          return;
        }
        const audioPlayerRef = state.playerState.audioPlayerRef;
        if (audioPlayerRef) {
          audioPlayerRef.currentTime = details.seekTime;
          state.actions.setProgress(Math.floor(details.seekTime));
        }
      }
    });

    mediaSession.setActionHandler("enterpictureinpicture", (details) => {
      const reason = (details as Record<string, unknown>)?.reason ?? "unknown";
      logger.info(
        `[MediaSession.handler] action=enterpictureinpicture | reason=${reason}`,
      );
      const state = usePlayerStore.getState();
      if (
        state.settings.pip.acceptBrowserPipRequest &&
        !state.playerState.pipWindowOpen &&
        "documentPictureInPicture" in window
      ) {
        state.actions.openPipWindow();
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
