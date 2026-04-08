import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";

const ONE_GB = 1073741824;

interface CacheSettings {
  coverArtCacheEnabled: boolean;
  audioCacheEnabled: boolean;
  audioCacheMaxSize: number;
}

interface CacheActions {
  setCoverArtCacheEnabled: (value: boolean) => void;
  setAudioCacheEnabled: (value: boolean) => void;
  setAudioCacheMaxSize: (value: number) => void;
}

interface CacheContext {
  settings: CacheSettings;
  actions: CacheActions;
}

export const useCacheStore = createWithEqualityFn<CacheContext>()(
  persist(
    devtools(
      immer((set) => ({
        settings: {
          coverArtCacheEnabled: true,
          audioCacheEnabled: true,
          audioCacheMaxSize: ONE_GB,
        },
        actions: {
          setCoverArtCacheEnabled: (value) => {
            set((state) => {
              state.settings.coverArtCacheEnabled = value;
            });
          },
          setAudioCacheEnabled: (value) => {
            set((state) => {
              state.settings.audioCacheEnabled = value;
            });
          },
          setAudioCacheMaxSize: (value) => {
            set((state) => {
              state.settings.audioCacheMaxSize = value;
            });
          },
        },
      })),
      { name: "cache_store" },
    ),
    {
      name: "cache_store",
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
  shallow,
);

export const useCacheSettings = () => useCacheStore((state) => state.settings);

export const useCacheActions = () => useCacheStore((state) => state.actions);
