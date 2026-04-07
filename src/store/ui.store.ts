import merge from "lodash/merge";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { IUiContext } from "@/types/uiContext";

export const useUiStore = createWithEqualityFn<IUiContext>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set) => ({
          sidebar: {
            isCollapsed: false,
            toggleSidebar: () => {
              set((state) => {
                state.sidebar.isCollapsed = !state.sidebar.isCollapsed;
              });
            },
            setIsCollapsed: (collapsed: boolean) => {
              set((state) => {
                state.sidebar.isCollapsed = collapsed;
              });
            },
          },
          songInfo: {
            songId: "",
            setSongId: (id) => {
              set((state) => {
                state.songInfo.songId = id;
              });
            },
            modalOpen: false,
            setModalOpen: (open) => {
              set((state) => {
                state.songInfo.modalOpen = open;
              });
            },
            reset: () => {
              set((state) => {
                state.songInfo.songId = "";
                state.songInfo.modalOpen = false;
              });
            },
          },
        })),
        {
          name: "ui_store",
        },
      ),
      {
        name: "ui_store",
        version: 1,
        merge: (persistedState, currentState) => {
          return merge(currentState, persistedState);
        },
        partialize: (state) => ({
          sidebar: {
            isCollapsed: state.sidebar.isCollapsed,
          },
        }),
      },
    ),
  ),
);

export const useSongInfo = () => useUiStore((state) => state.songInfo);
export const useSidebar = () => useUiStore((state) => state.sidebar);
