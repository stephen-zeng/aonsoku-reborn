import type { PlaybackRemoteCommand } from "@/player/playback";
import type { ISong } from "@/types/responses/song";
import { getCoverArtUrlFromSongPreference } from "./coverArt";
import { isValidDuration } from "./duration";
import { hasTauriBridge } from "./desktop";
import { logger } from "./logger";
import { getTauriInvoke, listenTauriEvent } from "./tauri";

const TAURI_EVENT_REMOTE_COMMAND = "media-remote-command";

export type TauriMediaPlaybackState = "none" | "playing" | "paused";

export interface TauriMediaSessionPayload {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  duration?: number;
  position?: number;
  playbackState: TauriMediaPlaybackState;
}

export interface TauriMediaRemoteCommandEvent {
  command: PlaybackRemoteCommand | "stop";
  position?: number;
}

async function invokeTauriMediaSession(
  command: string,
  args?: Record<string, unknown>,
) {
  const invoke = getTauriInvoke();
  if (!invoke) return;

  try {
    await invoke(command, args);
  } catch (error) {
    logger.error(`[TauriMediaSession] ${command} failed`, error);
  }
}

export function isTauriMediaSessionSupported() {
  return hasTauriBridge();
}

export async function listenTauriMediaRemoteCommands(
  handler: (event: TauriMediaRemoteCommandEvent) => void,
) {
  return listenTauriEvent<TauriMediaRemoteCommandEvent>(
    TAURI_EVENT_REMOTE_COMMAND,
    (event) => handler(event.payload),
  );
}

export function setTauriMediaSession(payload: TauriMediaSessionPayload) {
  return invokeTauriMediaSession("media_update_session", { payload });
}

export function clearTauriMediaSession() {
  return invokeTauriMediaSession("media_clear_session");
}

export function songToTauriMediaSessionPayload(
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
  playbackState: TauriMediaPlaybackState,
): TauriMediaSessionPayload {
  const artworkUrl =
    song.coverArt || song.albumId
      ? getCoverArtUrlFromSongPreference({
          coverArt: song.coverArt,
          coverArtType: "song",
          albumId: song.albumId,
        })
      : undefined;

  return {
    title: song.title || "Unknown Title",
    artist: song.artist || "Unknown Artist",
    album: song.album || "Unknown Album",
    artworkUrl,
    duration: isValidDuration(song.duration ?? 0) ? song.duration : undefined,
    playbackState,
  };
}

export function radioToTauriMediaSessionPayload(
  label: string,
  radioName: string,
  playbackState: TauriMediaPlaybackState,
): TauriMediaSessionPayload {
  return {
    title: radioName || "Unknown Radio",
    artist: label || "Radio",
    album: "",
    playbackState,
  };
}
