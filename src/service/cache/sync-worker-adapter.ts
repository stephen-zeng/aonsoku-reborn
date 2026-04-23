import { wrap, proxy, type Remote } from "comlink";
import { queryClient } from "@/lib/queryClient";
import { useAppStore } from "@/store/app.store";
import { useCacheStore } from "@/store/cache.store";
import { usePlayerStore } from "@/store/player.store";
import { getCacheIndexActions } from "@/store/cache-index.store";
import { metadataSyncService } from "@/service/cache/metadata-sync";
import type { SyncState } from "@/types/cache";
import type { AuthType } from "@/types/serverConfig";

interface WorkerAuthConfig {
  url: string;
  username: string;
  password: string;
  authType: AuthType | null;
  protocolVersion?: string;
  serverType?: string | null;
}

interface SyncOptions {
  includeCoverArt?: boolean;
  includeFullSongs?: boolean;
  mode?: "full" | "incremental";
  songCount?: number;
  downloadQuality?: "original" | "high" | "medium" | "low";
  useAlbumCoverForSongs?: boolean;
}

interface SyncWorkerService {
  syncAll(options: SyncOptions): Promise<void>;
  syncIncremental(options: SyncOptions): Promise<void>;
  cancel(): void;
  initAuth(config: WorkerAuthConfig): void;
  updateAuth(config: WorkerAuthConfig): void;
  onSyncStateUpdate:
    | ((state: Partial<SyncState>) => void)
    | undefined;
  onInvalidateQueries:
    | ((keys: string[][]) => void)
    | undefined;
  onLastSyncedAt: ((timestamp: number) => void) | undefined;
  onCacheIndexRefresh: (() => void) | undefined;
}

class SyncWorkerAdapter {
  private worker: Worker;
  private proxy: Remote<SyncWorkerService>;
  private unsubAuth: (() => void) | null = null;
  private authReady: Promise<void>;
  private lastServerUrl: string;

  constructor() {
    this.worker = new Worker(
      new URL("./sync.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onerror = (event) => {
      console.error("[syncWorkerAdapter] Worker error:", event.message);
      useCacheStore.getState().actions.updateSyncState({
        phase: "error",
        isSyncing: false,
      });
    };
    this.proxy = wrap<SyncWorkerService>(this.worker);

    const initialConfig = this.buildAuthConfig();
    this.lastServerUrl = initialConfig.url;
    this.setupCallbacks();
    this.authReady = this.proxy.initAuth(initialConfig);
    this.unsubAuth = useAppStore.subscribe((state) => {
      const config = this.buildAuthConfig(state.data);
      if (config.url !== this.lastServerUrl) {
        this.lastServerUrl = config.url;
        this.proxy.cancel();
      }
      this.proxy.updateAuth(config);
    });
  }

  private buildAuthConfig(
    data?: Parameters<typeof useAppStore.getState>[0]["data"],
  ): WorkerAuthConfig {
    const d = data ?? useAppStore.getState().data;
    return {
      url: d.url,
      username: d.username,
      password: d.password,
      authType: d.authType,
      protocolVersion: d.protocolVersion,
      serverType: d.serverType,
    };
  }

  private setupCallbacks(): void {
    this.proxy.onSyncStateUpdate = proxy((state: Partial<SyncState>) => {
      useCacheStore.getState().actions.updateSyncState(state);
    });

    this.proxy.onInvalidateQueries = proxy((keys: string[][]) => {
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    });

    this.proxy.onLastSyncedAt = proxy((timestamp: number) => {
      useCacheStore.getState().actions.setLastSyncedAt(timestamp);
    });

    this.proxy.onCacheIndexRefresh = proxy(() => {
      this.refreshCacheIndexFromIDB();
    });
  }

  private async refreshCacheIndexFromIDB(): Promise<void> {
    try {
      const { libraryDb } = await import("@/store/library-db");
      const rows = await libraryDb.cacheMeta.toArray();
      const actions = getCacheIndexActions();
      actions.clear();
      for (const row of rows) {
        actions.addItem(row.key, {
          id: row.id,
          type: row.type,
          source: row.source,
          triggers: row.triggers,
          quality: row.quality as
            | "original"
            | "high"
            | "medium"
            | "low"
            | undefined,
          coverSize: row.type === "cover" ? row.coverSize : undefined,
          sizeBytes: row.sizeBytes,
          cachedAt: row.cachedAt,
          lastAccessedAt: row.lastAccessedAt,
          removedFromServer: row.removedFromServer,
        });
      }
    } catch (err) {
      console.warn("[syncWorkerAdapter] failed to refresh cache index:", err);
    }
  }

  private buildSyncOptions(
    options?: { includeCoverArt?: boolean; includeFullSongs?: boolean },
  ): SyncOptions {
    const state = useCacheStore.getState();
    const appState = useAppStore.getState();
    const playerState = usePlayerStore.getState();
    return {
      includeCoverArt: options?.includeCoverArt ?? state.settings.syncCoverArt,
      includeFullSongs:
        options?.includeFullSongs ?? state.settings.libraryCaching,
      songCount: appState.data.songCount ?? 100_000,
      downloadQuality: state.settings.downloadQuality,
      useAlbumCoverForSongs:
        playerState.settings.coverArt.useAlbumCoverForSongs,
    };
  }

  async syncAll(options?: {
    includeCoverArt?: boolean;
    includeFullSongs?: boolean;
  }): Promise<void> {
    await this.authReady;
    await this.proxy.syncAll(this.buildSyncOptions(options));
  }

  async syncIncremental(options?: {
    includeCoverArt?: boolean;
    includeFullSongs?: boolean;
  }): Promise<void> {
    await this.authReady;
    await this.proxy.syncIncremental(this.buildSyncOptions(options));
  }

  cancel(): void {
    this.proxy.cancel();
  }

  terminate(): void {
    this.unsubAuth?.();
    this.worker.terminate();
  }
}

let syncService: SyncWorkerAdapter | typeof metadataSyncService;

try {
  if (typeof Worker !== "undefined") {
    syncService = new SyncWorkerAdapter();
  } else {
    syncService = metadataSyncService;
  }
} catch (err) {
  console.warn(
    "[syncWorkerAdapter] failed to create Worker, falling back to main thread:",
    err,
  );
  syncService = metadataSyncService;
}

export { syncService };