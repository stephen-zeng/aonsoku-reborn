import type { Draft } from "immer";
import type { IPlayerActions, IPlayerContext } from "@/types/playerContext";

interface SharedDeps {
  set: (fn: (state: Draft<IPlayerContext>) => void) => void;
  get: () => IPlayerContext;
}

export function createSettingsActions(shared: SharedDeps) {
  const { set } = shared;

  return {
    resetConfig: () => {
      set((state) => {
        state.settings.colors.queue.useSongColor = false;
        state.settings.colors.currentSongColorIntensity = 0.65;
        state.settings.fullscreen.autoFullscreenEnabled = false;
        state.settings.coverArt.useAlbumCoverForSongs = false;
        state.settings.lyrics.preferSyncedLyrics = false;
        state.settings.hapticFeedback.hapticFeedbackEnabled = true;
        state.settings.replayGain.values = {
          enabled: false,
          type: "track",
          preAmp: 0,
          error: false,
          defaultGain: -6,
        };
      });
    },

    setCurrentSongColor: (value: string | null) => {
      set((state) => {
        state.settings.colors.currentSongColor = value;
      });
    },

    setCurrentSongIntensity: (value: number) => {
      set((state) => {
        state.settings.colors.currentSongColorIntensity = value;
      });
    },

    setUseSongColorOnQueue: (value: boolean) => {
      set((state) => {
        state.settings.colors.queue.useSongColor = value;
      });
    },
  } satisfies Partial<IPlayerActions>;
}
