import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLanControlClientStore } from "@/store/lanControlClient.store";
import {
  useIsRemoteControlActive,
  usePlayerDuration,
  usePlayerIsPlaying,
  usePlayerMediaType,
  usePlayerProgress,
  usePlayerSonglist,
} from "@/store/player.store";
import { appName } from "@/utils/appName";
import { clampProgress, isValidDuration } from "@/utils/duration";
import { logger } from "@/utils/logger";
import { manageMediaSession } from "@/utils/setMediaSession";

export function MediaSessionObserver() {
  const { t } = useTranslation();
  const isPlaying = usePlayerIsPlaying();
  const { isRadio, isSong } = usePlayerMediaType();
  const { currentList, currentSongIndex, radioList } = usePlayerSonglist();
  const progress = usePlayerProgress();
  const currentDuration = usePlayerDuration();
  const radioLabel = t("radios.label");
  const isRemoteActive = useIsRemoteControlActive();

  const remotePlayerState = useLanControlClientStore(
    (state) => state.playerState,
  );
  const remoteCurrentSong = useLanControlClientStore(
    (state) => state.currentSong,
  );

  const lastMetadataRef = useRef<string>("");

  const song =
    isRemoteActive && remoteCurrentSong?.id
      ? {
          id: remoteCurrentSong.id,
          title: remoteCurrentSong.title,
          artist: remoteCurrentSong.artist,
          album: remoteCurrentSong.album,
          coverArt: remoteCurrentSong.coverArt,
          albumId: remoteCurrentSong.albumId,
          duration: remoteCurrentSong.duration,
        }
      : (currentList[currentSongIndex] ?? null);
  const radio = radioList[currentSongIndex] ?? null;

  const hasNothingPlaying = isRemoteActive
    ? !remoteCurrentSong || !remoteCurrentSong.id
    : currentList.length === 0 && radioList.length === 0;

  const resetAppTitle = useCallback(() => {
    document.title = appName;
  }, []);

  useEffect(() => {
    logger.info("[MediaSession] Remote control state changed:", isRemoteActive);
    manageMediaSession.setHandlers();
  }, [isRemoteActive]);

  useEffect(() => {
    logger.info("[MediaSession] State update:", {
      isRemoteActive,
      isPlaying: isRemoteActive ? remotePlayerState?.isPlaying : isPlaying,
      hasNothingPlaying,
      hasSong: !!song,
      songTitle: song?.title,
      songArtist: song?.artist,
    });

    const effectiveIsPlaying = isRemoteActive
      ? (remotePlayerState?.isPlaying ?? false)
      : isPlaying;

    manageMediaSession.setPlaybackState(effectiveIsPlaying);

    if (hasNothingPlaying) {
      logger.info("[MediaSession] Nothing playing, removing session");
      manageMediaSession.removeMediaSession();
      resetAppTitle();
      lastMetadataRef.current = "";
      return;
    }

    if (!effectiveIsPlaying) {
      resetAppTitle();
      return;
    }

    let title = "";
    let metadataKey = "";

    if (isRadio && radio) {
      title = `${radioLabel} - ${radio.name} | Aonsoku`;
      metadataKey = `radio:${radio.name}`;

      if (lastMetadataRef.current !== metadataKey) {
        logger.info("[MediaSession] Setting radio session:", title);
        manageMediaSession.setRadioMediaSession(radioLabel, radio.name);
        lastMetadataRef.current = metadataKey;
      }
    } else if (isSong && song) {
      title = `${song.title} - ${song.artist} | Aonsoku`;
      metadataKey = `song:${song.id || song.title}`;

      if (lastMetadataRef.current !== metadataKey) {
        logger.info("[MediaSession] Setting song session:", title);
        manageMediaSession.setMediaSession(song);
        lastMetadataRef.current = metadataKey;
      }
    }

    document.title = title;
  }, [
    hasNothingPlaying,
    isPlaying,
    isRadio,
    isSong,
    radio,
    radioLabel,
    song,
    resetAppTitle,
    isRemoteActive,
    remotePlayerState,
  ]);

  const lastPositionUpdateRef = useRef(0);

  useEffect(() => {
    const effectiveIsPlaying = isRemoteActive
      ? (remotePlayerState?.isPlaying ?? false)
      : isPlaying;

    if (!effectiveIsPlaying || hasNothingPlaying || !song) {
      return;
    }

    const duration = isRemoteActive ? (song.duration ?? 0) : currentDuration;

    if (!isValidDuration(duration)) {
      return;
    }

    const now = Date.now();
    if (now - lastPositionUpdateRef.current < 1000) {
      return;
    }
    lastPositionUpdateRef.current = now;

    const effectiveProgress =
      isRemoteActive && remotePlayerState?.currentTime !== undefined
        ? remotePlayerState.currentTime
        : progress;

    const clampedProgress = clampProgress(effectiveProgress, duration);
    manageMediaSession.setPositionState(duration, clampedProgress);
  }, [
    progress,
    isPlaying,
    hasNothingPlaying,
    song,
    isRemoteActive,
    remotePlayerState,
    currentDuration,
  ]);

  return null;
}
