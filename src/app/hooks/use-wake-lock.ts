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

      logger.info(`[WakeLock:acquire] isPlaying=${isPlaying} | type=screen`);

      sentinel.addEventListener("release", () => {
        logger.info("[WakeLock:release] reason=systemReleased");
        if (sentinelRef.current === sentinel) {
          sentinelRef.current = null;
        }
      });
    } catch (error) {
      logger.error(`[WakeLock:error] ${error instanceof Error ? error.message : String(error)}`);
      sentinelRef.current = null;
    } finally {
      isRequestingRef.current = false;
    }
  }, [isSupported, isPlaying]);

  const releaseWakeLock = useCallback(async () => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    try {
      await sentinel.release();
      logger.info("[WakeLock:release] reason=manualRelease");
    } catch (error) {
      logger.error(`[WakeLock:error] ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      sentinelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isSupported) return;

      if (isPlaying) {
        logger.info("[WakeLock:acquire] isPlaying=true | type=screen");
        requestWakeLock();
      } else {
        logger.info("[WakeLock:release] reason=isPlayingChanged | isPlaying=false");
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

      logger.info("[WakeLock:reacquire] visibilityState=visible | isPlayingNow=" + isPlayingNow);
      await requestWakeLock();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isSupported, requestWakeLock]);
}