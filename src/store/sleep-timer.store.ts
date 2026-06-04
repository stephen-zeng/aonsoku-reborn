import { create } from "zustand";

export type SleepTimerMode = "duration" | "end-of-track";

interface SleepTimerState {
  isActive: boolean;
  mode: SleepTimerMode;
  totalSeconds: number;
  remainingSeconds: number;
}

interface SleepTimerActions {
  startTimer: (seconds: number) => void;
  startEndOfTrack: () => void;
  cancelTimer: () => void;
  tick: () => void;
}

interface SleepTimerStore extends SleepTimerState, SleepTimerActions {}

export const useSleepTimerStore = create<SleepTimerStore>((set) => ({
  isActive: false,
  mode: "duration",
  totalSeconds: 0,
  remainingSeconds: 0,

  startTimer: (seconds: number) => {
    set({
      isActive: true,
      mode: "duration",
      totalSeconds: seconds,
      remainingSeconds: seconds,
    });
  },

  startEndOfTrack: () => {
    set({
      isActive: true,
      mode: "end-of-track",
      totalSeconds: 0,
      remainingSeconds: 0,
    });
  },

  cancelTimer: () => {
    set({
      isActive: false,
      mode: "duration",
      totalSeconds: 0,
      remainingSeconds: 0,
    });
  },

  tick: () => {
    set((state) => {
      if (!state.isActive || state.mode !== "duration") return state;
      const next = state.remainingSeconds - 1;
      if (next <= 0) {
        return {
          ...state,
          remainingSeconds: 0,
        };
      }
      return { ...state, remainingSeconds: next };
    });
  },
}));
