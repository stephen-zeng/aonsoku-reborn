import { useCallback, useEffect, useRef } from "react";
import { usePlayerIsPlaying, usePlayerStore } from "@/store/player.store";
import { logger } from "@/utils/logger";

export function useWakeLock() {
  const isPlaying = usePlayerIsPlaying();
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const isRequestingRef = useRef(false);

  const isSupported =
    typeof navigator !== "undefined" && "wakeLock" in navigator;

  const requestWakeLock = useCallback(async () => {
    if (!isSupported) return;
    if (isRequestingRef.current) return;

    try {
      isRequestingRef.current = true;
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;

      logger.info("[WakeLock] Acquired screen wake lock");

      sentinel.addEventListener("release", () => {
        logger.info("[WakeLock] Screen wake lock released");
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
        }
      });
    } catch (error) {
      logger.error("[WakeLock] Failed to acquire wake lock:", error);
      sentinelRef.current = null;
    } finally {
      isRequestingRef.current = false;
    }
  }, [isSupported]);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    try {
      await sentinel.release();
      logger.info("[WakeLock] Released screen wake lock");
    } catch (error) {
      logger.error("[WakeLock] Failed to release wake lock:", error);
    } finally {
      sentinelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    if (isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      releaseWakeLock();
    };
  }, [isPlaying, isSupported, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) return;

      const isPlayingNow = usePlayerStore.getState().playerState.isPlaying;
      if (!isPlayingNow) return;

      const sentinel = sentinelRef.current;
      if (sentinel && !sentinel.released) return;

      logger.info("[WakeLock] Page visible again, re-acquiring wake lock");
      await requestWakeLock();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSupported, requestWakeLock]);
}