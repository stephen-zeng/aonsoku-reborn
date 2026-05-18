import { queryClient } from "@/lib/queryClient";
import { AonsokuNativeData } from "@aonsoku/capacitor-native/data";
import { useCacheStore } from "@/store/cache.store";
import type { SyncState } from "@/types/cache";

class NativeSyncAdapter {
  private listenerHandles: Array<{ remove: () => Promise<void> }> = [];
  private initialized = false;

  constructor() {
    this.setupListeners();
  }

  private async setupListeners() {
    const syncHandle = await AonsokuNativeData.addListener(
      "syncStateChanged",
      (state: Partial<SyncState>) => {
        useCacheStore.getState().actions.updateSyncState(state);
      },
    );
    this.listenerHandles.push(syncHandle);

    const dataHandle = await AonsokuNativeData.addListener(
      "dataChanged",
      (event: { tables: string[] }) => {
        const queryKeyMap: Record<string, string[][]> = {
          artists: [["artists"]],
          albums: [["albums"]],
          songs: [["songs"], ["favorites", "count"], ["favorites", "list"]],
          playlists: [["playlists"], ["playlists", "single"]],
          genres: [["genres"]],
          favorites: [["favorites", "count"], ["favorites", "list"]],
        };

        for (const table of event.tables) {
          const keys = queryKeyMap[table];
          if (keys) {
            for (const key of keys) {
              queryClient.invalidateQueries({ queryKey: key });
            }
          }
        }
      },
    );
    this.listenerHandles.push(dataHandle);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await AonsokuNativeData.initialize();
    this.initialized = true;
  }

  async syncAll(): Promise<void> {
    await this.initialize();
    await AonsokuNativeData.syncAll();
  }

  async syncIncremental(): Promise<void> {
    await this.initialize();
    await AonsokuNativeData.syncIncremental();
  }

  cancel(): void {
    AonsokuNativeData.cancelSync();
  }
}

export const nativeSyncAdapter = new NativeSyncAdapter();
