import merge from "lodash/merge";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import {
  CacheMode,
  CacheSettings,
  CacheStatus,
  DEFAULT_MAX_CACHE_SIZE,
  SyncState,
} from "@/types/cache";

interface CacheActions {
  setMode: (mode: CacheMode) => void;
  setMaxCacheSize: (bytes: number) => void;
  setSyncCoverArt: (enabled: boolean) => void;
  setSyncOnLaunch: (enabled: boolean) => void;
  setIsOnline: (online: boolean) => void;
  updateCacheStats: (stats: {
    audioSize: number;
    coverSize: number;
    audioCount: number;
    coverCount: number;
  }) => void;
  updateSyncState: (syncState: Partial<SyncState>) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
}

interface CacheStoreState {
  settings: CacheSettings;
  status: CacheStatus;
  actions: CacheActions;
}

const defaultSyncState: SyncState = {
  phase: "idle",
  progress: 0,
  isSyncing: false,
  totalItems: 0,
  processedItems: 0,
};

export const useCacheStore = createWithEqualityFn<CacheStoreState>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set) => ({
          settings: {
            mode: "none" as CacheMode,
            maxCacheSize: DEFAULT_MAX_CACHE_SIZE,
            syncCoverArt: false,
            syncOnLaunch: true,
          },
          status: {
            isOnline: navigator.onLine,
            currentAudioCacheSize: 0,
            currentCoverCacheSize: 0,
            audioCachedCount: 0,
            coverCachedCount: 0,
            syncState: { ...defaultSyncState },
            lastSyncedAt: null,
          },
          actions: {
            setMode: (mode) => {
              set((state) => {
                state.settings.mode = mode;
              });
            },
            setMaxCacheSize: (bytes) => {
              set((state) => {
                state.settings.maxCacheSize = bytes;
              });
            },
            setSyncCoverArt: (enabled) => {
              set((state) => {
                state.settings.syncCoverArt = enabled;
              });
            },
            setSyncOnLaunch: (enabled) => {
              set((state) => {
                state.settings.syncOnLaunch = enabled;
              });
            },
            setIsOnline: (online) => {
              set((state) => {
                state.status.isOnline = online;
              });
            },
            updateCacheStats: (stats) => {
              set((state) => {
                state.status.currentAudioCacheSize = stats.audioSize;
                state.status.currentCoverCacheSize = stats.coverSize;
                state.status.audioCachedCount = stats.audioCount;
                state.status.coverCachedCount = stats.coverCount;
              });
            },
            updateSyncState: (syncState) => {
              set((state) => {
                Object.assign(state.status.syncState, syncState);
              });
            },
            setLastSyncedAt: (timestamp) => {
              set((state) => {
                state.status.lastSyncedAt = timestamp;
              });
            },
          },
        })),
        { name: "cache_store" },
      ),
      {
        name: "cache_settings",
        partialize: (state) => ({
          settings: state.settings,
          status: {
            lastSyncedAt: state.status.lastSyncedAt,
          },
        }),
        merge: (persisted, current) => merge({}, current, persisted),
      },
    ),
  ),
  shallow,
);

// Selective hooks
export const useCacheMode = () =>
  useCacheStore((state) => state.settings.mode);

export const useCacheSettings = () =>
  useCacheStore((state) => state.settings);

export const useCacheStatus = () =>
  useCacheStore((state) => state.status);

export const useCacheStats = () =>
  useCacheStore(
    (state) => ({
      audioSize: state.status.currentAudioCacheSize,
      coverSize: state.status.currentCoverCacheSize,
      audioCount: state.status.audioCachedCount,
      coverCount: state.status.coverCachedCount,
    }),
    shallow,
  );

export const useIsOnline = () =>
  useCacheStore((state) => state.status.isOnline);

export const useIsOfflineMode = () =>
  useCacheStore(
    (state) =>
      state.settings.mode === "offline" && !state.status.isOnline,
  );

export const useSyncState = () =>
  useCacheStore((state) => state.status.syncState);

export const useLastSyncedAt = () =>
  useCacheStore((state) => state.status.lastSyncedAt);

export const useCacheActions = () =>
  useCacheStore((state) => state.actions);
