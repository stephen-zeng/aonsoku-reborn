import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import {
  runFullSync,
  type SyncPhase,
  type SyncProgress,
} from "@/lib/sync/sync-engine";
import { useCacheStore } from "@/store/cache.store";

// ─── Persisted settings ────────────────────────────────

interface SyncSettings {
  syncOnLaunchEnabled: boolean;
  syncCoverArt: boolean;
}

// ─── Transient runtime state (NOT persisted) ───────────

interface SyncRuntimeState {
  status: "idle" | "running" | "done" | "error" | "cancelled";
  phase: SyncPhase;
  current: number;
  total: number;
  phaseIndex: number;
  totalPhases: number;
  lastSyncedAt: number | null;
  error: string | null;
}

// ─── Actions ───────────────────────────────────────────

interface SyncActions {
  setSyncOnLaunchEnabled: (value: boolean) => void;
  setSyncCoverArt: (value: boolean) => void;
  startSync: () => void;
  cancelSync: () => void;
  setLastSyncedAt: (ts: number | null) => void;
}

interface SyncContext {
  settings: SyncSettings;
  state: SyncRuntimeState;
  actions: SyncActions;
}

// AbortController stored outside Zustand (not serializable)
let abortController: AbortController | null = null;

const TERMINAL_PHASES = new Set(["done", "cancelled", "error"]);
const PROGRESS_THROTTLE_MS = 250;

export const useSyncStore = createWithEqualityFn<SyncContext>()(
  persist(
    devtools(
      immer((set, get) => ({
        settings: {
          syncOnLaunchEnabled: false,
          syncCoverArt: false,
        },
        state: {
          status: "idle" as const,
          phase: "idle" as SyncPhase,
          current: 0,
          total: 0,
          phaseIndex: 0,
          totalPhases: 0,
          lastSyncedAt: null,
          error: null,
        },
        actions: {
          setSyncOnLaunchEnabled: (value) => {
            set((draft) => {
              draft.settings.syncOnLaunchEnabled = value;
            });
          },
          setSyncCoverArt: (value) => {
            set((draft) => {
              draft.settings.syncCoverArt = value;
            });
          },
          startSync: () => {
            const currentStatus = get().state.status;
            if (currentStatus === "running") return;

            abortController = new AbortController();

            set((draft) => {
              draft.state.status = "running";
              draft.state.phase = "idle";
              draft.state.current = 0;
              draft.state.total = 0;
              draft.state.phaseIndex = 0;
              draft.state.error = null;
            });

            const { syncCoverArt } = get().settings;
            // Only include cover art sync if cache is also enabled
            const coverArtEnabled =
              useCacheStore.getState().settings.coverArtCacheEnabled;

            runFullSync({
              includeCoverArt: syncCoverArt && coverArtEnabled,
              signal: abortController.signal,
              onProgress: (() => {
                let lastUpdate = 0;
                return (progress: SyncProgress) => {
                  const isTerminal = TERMINAL_PHASES.has(progress.phase);
                  const now = Date.now();
                  if (!isTerminal && now - lastUpdate < PROGRESS_THROTTLE_MS) {
                    return;
                  }
                  lastUpdate = now;

                  set((draft) => {
                    draft.state.phase = progress.phase;
                    draft.state.current = progress.current;
                    draft.state.total = progress.total;
                    draft.state.phaseIndex = progress.phaseIndex;
                    draft.state.totalPhases = progress.totalPhases;

                    if (progress.phase === "done") {
                      draft.state.status = "done";
                      draft.state.lastSyncedAt = Date.now();
                    } else if (progress.phase === "cancelled") {
                      draft.state.status = "cancelled";
                    } else if (progress.phase === "error") {
                      draft.state.status = "error";
                    }
                  });
                };
              })(),
            })
              .catch((err) => {
                const s = get().state.status;
                if (s !== "cancelled") {
                  set((draft) => {
                    draft.state.status = "error";
                    draft.state.error =
                      err instanceof Error ? err.message : "Unknown sync error";
                  });
                }
              })
              .finally(() => {
                abortController = null;
              });
          },
          cancelSync: () => {
            abortController?.abort();
            abortController = null;
          },
          setLastSyncedAt: (ts) => {
            set((draft) => {
              draft.state.lastSyncedAt = ts;
            });
          },
        },
      })),
      { name: "sync_store" },
    ),
    {
      name: "sync_store",
      partialize: (state) => ({
        settings: state.settings,
      }),
    },
  ),
  shallow,
);

export const useSyncSettings = () => useSyncStore((s) => s.settings);

export const useSyncState = () => useSyncStore((s) => s.state);

export const useSyncActions = () => useSyncStore((s) => s.actions);

// ─── Side-effect: disable syncCoverArt when cover art cache is disabled ────
// Subscribe to the cache store so that turning off the cover art cache
// automatically resets the syncCoverArt toggle. Using subscribe here avoids
// a circular import (cache.store would import sync.store and vice-versa).
useCacheStore.subscribe((state) => {
  if (
    !state.settings.coverArtCacheEnabled &&
    useSyncStore.getState().settings.syncCoverArt
  ) {
    useSyncStore.getState().actions.setSyncCoverArt(false);
  }
});
