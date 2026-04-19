import merge from "lodash/merge";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import {
  CacheSettings,
  CacheStatus,
  DEFAULT_MAX_CACHE_SIZE,
  DownloadQuality,
  SyncState,
} from "@/types/cache";

interface CacheActions {
  setDownloadQuality: (quality: DownloadQuality) => void;
  setMaxCacheSize: (bytes: number) => void;
  setSyncLibrary: (enabled: boolean) => void;
  setSyncCoverArt: (enabled: boolean) => void;
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

function migrateSettings(persisted: Record<string, unknown>): CacheSettings {
  if (persisted && typeof persisted === "object" && "mode" in persisted) {
    const old = persisted as Record<string, unknown>;
    return {
      downloadQuality: "stream" as DownloadQuality,
      maxCacheSize:
        typeof old.maxCacheSize === "number"
          ? old.maxCacheSize
          : DEFAULT_MAX_CACHE_SIZE,
      syncLibrary: old.mode === "offline",
      syncCoverArt:
        typeof old.syncCoverArt === "boolean" ? old.syncCoverArt : false,
    };
  }
  return persisted as unknown as CacheSettings;
}

export const useCacheStore = createWithEqualityFn<CacheStoreState>()(
  subscribeWithSelector(
    persist(
      devtools(
        immer((set) => ({
          settings: {
            downloadQuality: "stream" as DownloadQuality,
            maxCacheSize: DEFAULT_MAX_CACHE_SIZE,
            // Default-on post-P1.3: the toggle now controls whether the
            // long-running full-songs sync step runs. T1/T2 metadata
            // (artists, albums, playlists, genres) always sync regardless.
            syncLibrary: true,
            syncCoverArt: false,
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
            setDownloadQuality: (quality) => {
              set((state) => {
                state.settings.downloadQuality = quality;
              });
            },
            setMaxCacheSize: (bytes) => {
              set((state) => {
                state.settings.maxCacheSize = bytes;
              });
            },
            setSyncLibrary: (enabled) => {
              set((state) => {
                state.settings.syncLibrary = enabled;
              });
            },
            setSyncCoverArt: (enabled) => {
              set((state) => {
                state.settings.syncCoverArt = enabled;
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
        merge: (persisted, current) => {
          const raw = persisted as Record<string, unknown> | null;
          if (!raw) return current;
          const settings = raw.settings as Record<string, unknown> | undefined;
          if (settings) {
            raw.settings = migrateSettings(settings);
          }
          return merge({}, current, raw);
        },
      },
    ),
  ),
  shallow,
);

export const useDownloadQuality = () =>
  useCacheStore((state) => state.settings.downloadQuality);

export const useCacheSettings = () => useCacheStore((state) => state.settings);

export const useCacheStatus = () => useCacheStore((state) => state.status);

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
  useCacheStore((state) => !state.status.isOnline);

export const useSyncState = () =>
  useCacheStore((state) => state.status.syncState);

export const useLastSyncedAt = () =>
  useCacheStore((state) => state.status.lastSyncedAt);

export const useCacheActions = () => useCacheStore((state) => state.actions);
