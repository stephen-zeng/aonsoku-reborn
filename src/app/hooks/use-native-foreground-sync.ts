import { useEffect } from "react";
import { subsonic } from "@/service/subsonic";
import { getQueueController } from "@/player/queue-controller";
import { NativeQueueController } from "@/player/queue-controller/native-controller";
import { getNativeAudioPluginAvailability } from "@/native/audio/facade";
import { getRuntime } from "@/utils/capabilities";
import { logger } from "@/utils/logger";

export function useNativeForegroundSync() {
  useEffect(() => {
    if (getRuntime() !== "capacitor-ios") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncOnForeground();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}

async function syncOnForeground() {
  const controller = getQueueController();
  if (controller instanceof NativeQueueController) {
    await controller.syncFromNative();
  }

  await flushScrobbleBuffer();
}

async function flushScrobbleBuffer() {
  const availability = getNativeAudioPluginAvailability();
  if (!availability.available) return;

  try {
    const result = await availability.plugin.getScrobbleBuffer();
    const entries = result.entries ?? [];

    if (entries.length === 0) return;

    logger.info(`[ForegroundSync] Flushing ${entries.length} scrobble entries`);

    for (const entry of entries) {
      const durationSec = entry.playedDurationMs / 1000;
      const songDuration = durationSec;
      const threshold = Math.min(songDuration * 0.5, 240);

      if (durationSec >= threshold) {
        await subsonic.scrobble.send(entry.songId, true);
      }
    }

    await availability.plugin.clearScrobbleBuffer();
  } catch (err) {
    logger.error("[ForegroundSync] flushScrobbleBuffer failed", err);
  }
}
