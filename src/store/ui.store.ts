import merge from "lodash/merge";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createWithEqualityFn } from "zustand/traditional";
import { IUiContext } from "@/types/uiContext";

export const DEFAULT_SIDEBAR_WIDTH = 280;
export const DEFAULT_RIGHT_PANEL_WIDTH = 280;

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
            width: DEFAULT_SIDEBAR_WIDTH,
            setWidth: (width: number) => {
              set((state) => {
                state.sidebar.width = width;
              });
            },
            resetWidth: () => {
              set((state) => {
                state.sidebar.width = DEFAULT_SIDEBAR_WIDTH;
              });
            },
          },
          rightPanel: {
            width: DEFAULT_RIGHT_PANEL_WIDTH,
            setWidth: (width: number) => {
              set((state) => {
                state.rightPanel.width = width;
              });
            },
            resetWidth: () => {
              set((state) => {
                state.rightPanel.width = DEFAULT_RIGHT_PANEL_WIDTH;
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
        version: 2,
        merge: (persistedState, currentState) => {
          return merge(currentState, persistedState);
        },
        partialize: (state) => ({
          sidebar: {
            isCollapsed: state.sidebar.isCollapsed,
            width: state.sidebar.width,
          },
          rightPanel: {
            width: state.rightPanel.width,
          },
        }),
        migrate: (persistedState, version) => {
          if (version < 2) {
            const state = persistedState as Record<string, unknown>;
            return {
              ...state,
              sidebar: {
                ...(state.sidebar as Record<string, unknown>),
                width: DEFAULT_SIDEBAR_WIDTH,
              },
              rightPanel: {
                width: DEFAULT_RIGHT_PANEL_WIDTH,
              },
            };
          }
          return persistedState;
        },
      },
    ),
  ),
);

export const useSongInfo = () => useUiStore((state) => state.songInfo);
export const useSidebar = () => useUiStore((state) => state.sidebar);
export const useRightPanel = () =>
  useUiStore((state) => state.rightPanel);
