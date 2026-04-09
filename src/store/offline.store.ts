import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { audioCache } from "@/lib/cache/audio-cache";

type CachedSongMap = Record<string, true>;

interface OfflineState {
  isOfflineMode: boolean;
  isReconnecting: boolean;
  cachedSongIds: CachedSongMap;
}

interface OfflineActions {
  enterOfflineMode: () => Promise<void>;
  clearOfflineMode: () => void;
  setReconnecting: (value: boolean) => void;
  refreshCachedSongIds: () => Promise<void>;
}

interface OfflineContext {
  state: OfflineState;
  actions: OfflineActions;
}

function buildCachedMap(ids: string[]): CachedSongMap {
  const map: CachedSongMap = {};
  for (const id of ids) {
    map[id] = true;
  }
  return map;
}

export const useOfflineStore = createWithEqualityFn<OfflineContext>()(
  subscribeWithSelector(
    devtools(
      immer((set) => ({
        state: {
          isOfflineMode: false,
          isReconnecting: false,
          cachedSongIds: {} as CachedSongMap,
        },
        actions: {
          enterOfflineMode: async () => {
            const ids = await audioCache.getCachedSongIds();
            set((draft) => {
              draft.state.isOfflineMode = true;
              draft.state.isReconnecting = false;
              draft.state.cachedSongIds = buildCachedMap(ids);
            });
          },
          clearOfflineMode: () => {
            set((draft) => {
              draft.state.isOfflineMode = false;
              draft.state.isReconnecting = false;
              draft.state.cachedSongIds = {};
            });
          },
          setReconnecting: (value) => {
            set((draft) => {
              draft.state.isReconnecting = value;
            });
          },
          refreshCachedSongIds: async () => {
            const ids = await audioCache.getCachedSongIds();
            set((draft) => {
              draft.state.cachedSongIds = buildCachedMap(ids);
            });
          },
        },
      })),
      { name: "offline_store" },
    ),
  ),
  shallow,
);

export const useIsOffline = () =>
  useOfflineStore((ctx) => ctx.state.isOfflineMode);

export const useOfflineState = () => useOfflineStore((ctx) => ctx.state);

export const useOfflineActions = () => useOfflineStore((ctx) => ctx.actions);
