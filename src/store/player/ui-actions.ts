import type { Draft } from "immer";
import type { IPlayerActions, IPlayerContext } from "@/types/playerContext";

interface SharedDeps {
  set: (fn: (state: Draft<IPlayerContext>) => void) => void;
  get: () => IPlayerContext;
}

export function createUiActions(shared: SharedDeps) {
  const { set, get } = shared;

  return {
    setMainDrawerState: (status: boolean) => {
      set((state) => {
        state.playerState.mainDrawerState = status;
      });
    },

    setQueueState: (status: boolean) => {
      set((state) => {
        state.playerState.queueState = status;
      });
    },

    toggleQueueAction: () => {
      const { mainDrawerState, lyricsState, queueState } = get().playerState;
      const { toggleQueueAndLyrics, setQueueState, setMainDrawerState } =
        get().actions;

      if (mainDrawerState && lyricsState) {
        toggleQueueAndLyrics();
      } else {
        setQueueState(!queueState);
        setMainDrawerState(!mainDrawerState);
      }
    },

    setLyricsState: (status: boolean) => {
      set((state) => {
        state.playerState.lyricsState = status;
      });
    },

    toggleLyricsAction: () => {
      const { mainDrawerState, lyricsState, queueState } = get().playerState;
      const { toggleQueueAndLyrics, setLyricsState, setMainDrawerState } =
        get().actions;

      if (mainDrawerState && queueState) {
        toggleQueueAndLyrics();
      } else {
        setLyricsState(!lyricsState);
        setMainDrawerState(!mainDrawerState);
      }
    },

    toggleQueueAndLyrics: () => {
      const { queueState, lyricsState } = get().playerState;

      set((state) => {
        state.playerState.queueState = !queueState;
        state.playerState.lyricsState = !lyricsState;
      });
    },

    closeDrawer: () => {
      set((state) => {
        state.playerState.mainDrawerState = false;
        state.playerState.queueState = false;
        state.playerState.lyricsState = false;
      });
    },

    openFullscreenPlayer: (tab = "playing" as const) => {
      set((state) => {
        state.playerState.mainDrawerState = false;
        state.playerState.queueState = false;
        state.playerState.lyricsState = false;
        state.playerState.fullscreenPlayerOpen = true;
        state.playerState.fullscreenPlayerTab = tab;
      });
    },

    closeFullscreenPlayer: () => {
      set((state) => {
        state.playerState.fullscreenPlayerOpen = false;
      });
    },

    setFullscreenPlayerTab: (tab: "queue" | "playing" | "lyrics") => {
      set((state) => {
        state.playerState.fullscreenPlayerTab = tab;
      });
    },

    setDesktopFullscreenPanelView: (view: "queue" | "lyrics" | null) => {
      set((state) => {
        state.playerState.desktopFullscreenPanelView = view;
      });
    },

    setAreLyricsAligned: (aligned: boolean) => {
      set((state) => {
        state.playerState.areLyricsAligned = aligned;
      });
    },

    openPipWindow: () => {
      set((state) => {
        state.playerState.pipWindowOpen = true;
      });
    },

    closePipWindow: () => {
      set((state) => {
        state.playerState.pipWindowOpen = false;
      });
    },
  } satisfies Partial<IPlayerActions>;
}
