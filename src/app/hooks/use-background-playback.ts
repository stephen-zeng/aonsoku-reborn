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
      const audio = isRadio
        ? playerState.radioPlayerRef
        : playerState.audioPlayerRef;

      if (!audio) return;

      if (!audio.paused && !audio.ended) {
        logger.info(
          `[BackgroundPlayback] visibility=visible | audio already playing | isRadio=${isRadio}`,
        );
        return;
      }

      if (!audio.src) return;

      const label = isRadio ? "Radio" : "Song";
      logger.info(
        `[BackgroundPlayback] visibility=visible | resuming ${label} | paused=${audio.paused} | ended=${audio.ended}`,
      );

      if (timeoutId !== null) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        const latestState = usePlayerStore.getState();
        if (!latestState.playerState.isPlaying) return;

        const latestIsRadio = latestState.playerState.mediaType === "radio";
        const currentAudio = latestIsRadio
          ? latestState.playerState.radioPlayerRef
          : latestState.playerState.audioPlayerRef;

        if (currentAudio !== audio) {
          logger.info(
            `[BackgroundPlayback] stale audio ref, skipping resume | isRadio=${latestIsRadio}`,
          );
          return;
        }

        if (!latestState.remoteControl.active) {
          manageMediaSession.ensurePlaybackStatePlaying();
        }

        audio.play().catch((error) => {
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
