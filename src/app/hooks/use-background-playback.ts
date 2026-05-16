import { useEffect } from "react";
import { usePlayerStore } from "@/store/player.store";
import { logger } from "@/utils/logger";
import { manageMediaSession } from "@/utils/setMediaSession";

const RESUME_DELAY_MS = 100;

export function useBackgroundPlayback() {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleVisibilityChange = () => {
      if (document.hidden) return;

      const { isPlaying, remoteControl, playerState } =
        usePlayerStore.getState();

      if (!isPlaying || remoteControl.active) return;

      const isRadio = playerState.mediaType === "radio";
      const engine = isRadio
        ? playerState.radioPlayerRef
        : playerState.audioPlayerRef;

      if (!engine) return;

      if (!engine.isPaused() && !engine.isEnded()) {
        logger.info(
          `[BackgroundPlayback] visibility=visible | audio already playing | isRadio=${isRadio}`,
        );
        return;
      }

      if (!engine.hasSrc()) return;

      const label = isRadio ? "Radio" : "Song";
      logger.info(
        `[BackgroundPlayback] visibility=visible | resuming ${label} | paused=${engine.isPaused()} | ended=${engine.isEnded()}`,
      );

      if (timeoutId !== null) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        const latestState = usePlayerStore.getState();
        if (!latestState.playerState.isPlaying) return;

        const latestIsRadio = latestState.playerState.mediaType === "radio";
        const currentEngine = latestIsRadio
          ? latestState.playerState.radioPlayerRef
          : latestState.playerState.audioPlayerRef;

        if (currentEngine !== engine) {
          logger.info(
            `[BackgroundPlayback] stale audio ref, skipping resume | isRadio=${latestIsRadio}`,
          );
          return;
        }

        if (!latestState.remoteControl.active) {
          manageMediaSession.ensurePlaybackStatePlaying();
        }

        engine.play().catch((error) => {
          if (error.name !== "AbortError") {
            logger.error(
              `[BackgroundPlayback] resume failed | ${error.name}: ${error.message}`,
            );
          }
        });
      }, RESUME_DELAY_MS);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, []);
}
