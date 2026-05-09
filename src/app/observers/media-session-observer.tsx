import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLanControlClientStore } from "@/store/lanControlClient.store";
import {
  useIsRemoteControlActive,
  usePlayerDuration,
  usePlayerIsPlaying,
  usePlayerIsTransitioning,
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
  const isTransitioning = usePlayerIsTransitioning();
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
      isTransitioning,
      hasNothingPlaying,
      hasSong: !!song,
      songTitle: song?.title,
      songArtist: song?.artist,
    });

    const effectiveIsPlaying = isRemoteActive
      ? (remotePlayerState?.isPlaying ?? false)
      : isPlaying;

    if (isTransitioning) {
      manageMediaSession.ensurePlaybackStatePlaying();
    } else {
      manageMediaSession.setPlaybackState(effectiveIsPlaying);
    }

    if (hasNothingPlaying && !isTransitioning) {
      logger.info("[MediaSession] Nothing playing, removing session");
      manageMediaSession.removeMediaSession();
      resetAppTitle();
      lastMetadataRef.current = "";
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

    if (!effectiveIsPlaying && !isTransitioning) {
      resetAppTitle();
    } else if (title) {
      document.title = title;
    }
  }, [
    hasNothingPlaying,
    isPlaying,
    isRadio,
    isSong,
    isTransitioning,
    radio,
    radioLabel,
    song,
    resetAppTitle,
    isRemoteActive,
    remotePlayerState,
  ]);

  const lastPositionStateRef = useRef({
    progress: -1,
    timestamp: 0,
    isPlaying: false,
    songId: "",
  });

  useEffect(() => {
    const effectiveIsPlaying = isRemoteActive
      ? (remotePlayerState?.isPlaying ?? false)
      : isPlaying;

    if (hasNothingPlaying || !song) {
      return;
    }

    const duration = isRemoteActive ? (song.duration ?? 0) : currentDuration;

    if (!isValidDuration(duration)) {
      return;
    }

    const effectiveProgress =
      isRemoteActive && remotePlayerState?.currentTime !== undefined
        ? remotePlayerState.currentTime
        : progress;

    const songId =
      (song as { id?: string })?.id || (song as { title: string }).title;
    const now = Date.now();
    const lastState = lastPositionStateRef.current;

    // Determine if we need to update the position state
    let shouldUpdate = false;

    if (songId !== lastState.songId) {
      // 1. Song changed
      shouldUpdate = true;
    } else if (effectiveIsPlaying !== lastState.isPlaying) {
      // 2. Playback state toggled
      shouldUpdate = true;
    } else {
      // 3. Check for seek (progress jump)
      // Expected progress based on natural playback since last report
      const elapsedSeconds = (now - lastState.timestamp) / 1000;
      const expectedProgress = lastState.isPlaying
        ? lastState.progress + elapsedSeconds
        : lastState.progress;

      // If actual progress deviates from expected by more than 2 seconds, it's a seek
      if (Math.abs(effectiveProgress - expectedProgress) > 2) {
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      const clampedProgress = clampProgress(effectiveProgress, duration);
      manageMediaSession.setPositionState(duration, clampedProgress);

      lastPositionStateRef.current = {
        progress: effectiveProgress,
        timestamp: now,
        isPlaying: effectiveIsPlaying,
        songId,
      };
    }
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
