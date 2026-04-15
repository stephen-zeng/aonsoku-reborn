import merge from "lodash/merge";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import type { IPlayHistoryContext } from "@/types/playHistory";
import type { ISong } from "@/types/responses/song";
import { createIdbStorage } from "./idb";

const IDB_KEY = "player_history";

export const usePlayHistoryStore = createWithEqualityFn<IPlayHistoryContext>()(
  persist(
    devtools(
      immer((set) => ({
        history: [],
        maxSize: 100,
        actions: {
          addToHistory: (song: ISong) => {
            set((state) => {
              state.history.unshift(song);
              if (state.history.length > state.maxSize) {
                state.history.splice(state.maxSize);
              }
            });
          },
          removeFromHistory: (index: number) => {
            set((state) => {
              if (index >= 0 && index < state.history.length) {
                state.history.splice(index, 1);
              }
            });
          },
          clearHistory: () => {
            set((state) => {
              state.history = [];
            });
          },
          setMaxSize: (size: number) => {
            const clampedSize = Math.max(1, Math.round(size));
            set((state) => {
              if (state.maxSize === clampedSize) return;
              state.maxSize = clampedSize;
              if (state.history.length > clampedSize) {
                state.history.splice(clampedSize);
              }
            });
          },
        },
      })),
      { name: "play_history_store" },
    ),
    {
      name: IDB_KEY,
      version: 1,
      storage: createIdbStorage<IPlayHistoryContext>(),
      merge: (persistedState, currentState) =>
        merge(currentState, persistedState),
      partialize: (state) => ({
        history: state.history,
        maxSize: state.maxSize,
      }),
    },
  ),
  shallow,
);

export const usePlayHistory = () =>
  usePlayHistoryStore((state) => state.history);

export const usePlayHistoryMaxSize = () =>
  usePlayHistoryStore((state) => state.maxSize);

export const usePlayHistoryActions = () =>
  usePlayHistoryStore((state) => state.actions);
