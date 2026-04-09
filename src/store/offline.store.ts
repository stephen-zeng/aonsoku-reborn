import { devtools, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { checkConfiguredServerConnectivity } from "@/api/checkConfiguredServer";
import { audioCache } from "@/lib/cache/audio-cache";

type CachedSongMap = Record<string, true>;

interface OfflineState {
  isOfflineMode: boolean;
  isReconnecting: boolean;
  lastConnectivityCheckAt: number | null;
  cachedSongIds: CachedSongMap;
}

interface OfflineActions {
  enterOfflineMode: () => Promise<void>;
  clearOfflineMode: () => void;
  setReconnecting: (value: boolean) => void;
  tryReconnect: () => Promise<boolean>;
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
          lastConnectivityCheckAt: null,
          cachedSongIds: {} as CachedSongMap,
        },
        actions: {
          enterOfflineMode: async () => {
            const ids = await audioCache.getCachedSongIds();
            set((draft) => {
              draft.state.isOfflineMode = true;
              draft.state.isReconnecting = false;
              draft.state.lastConnectivityCheckAt = Date.now();
              draft.state.cachedSongIds = buildCachedMap(ids);
            });
          },
          clearOfflineMode: () => {
            set((draft) => {
              draft.state.isOfflineMode = false;
              draft.state.isReconnecting = false;
              draft.state.lastConnectivityCheckAt = null;
              draft.state.cachedSongIds = {};
            });
          },
          setReconnecting: (value) => {
            set((draft) => {
              draft.state.isReconnecting = value;
            });
          },
          tryReconnect: async () => {
            set((draft) => {
              draft.state.isReconnecting = true;
              draft.state.lastConnectivityCheckAt = Date.now();
            });

            const isServerReachable = await checkConfiguredServerConnectivity();

            if (isServerReachable) {
              set((draft) => {
                draft.state.isOfflineMode = false;
                draft.state.isReconnecting = false;
                draft.state.lastConnectivityCheckAt = null;
                draft.state.cachedSongIds = {};
              });
              return true;
            }

            set((draft) => {
              draft.state.isOfflineMode = true;
              draft.state.isReconnecting = false;
            });
            return false;
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
