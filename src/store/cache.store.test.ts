import { beforeEach, describe, expect, it } from "vitest";
import { useCacheStore } from "./cache.store";

beforeEach(() => {
  useCacheStore.setState({
    settings: {
      maxCacheSize: 2_147_483_648,
      assetsQuota: 536_870_912,
      lruQuota: 1_073_741_824,
      smartRules: {
        enabled: false,
        favoriteSongs: true,
        favoritePlaylists: true,
      },
      libraryCaching: false,
      syncLibrary: true,
      syncCoverArt: false,
      coverArtConcurrency: 4,
    },
    status: {
      isOnline: true,
      isMetered: false,
      currentAudioCacheSize: 0,
      currentCoverCacheSize: 0,
      audioCachedCount: 0,
      coverCachedCount: 0,
      syncState: {
        phase: "idle",
        progress: 0,
        isSyncing: false,
        totalItems: 0,
        processedItems: 0,
      },
      lastSyncedAt: null,
    },
  });
});

describe("useCacheStore actions", () => {
  it("setMaxCacheSize updates settings", () => {
    useCacheStore.getState().actions.setMaxCacheSize(500);
    expect(useCacheStore.getState().settings.maxCacheSize).toBe(500);
  });

  it("setAssetsQuota updates settings", () => {
    useCacheStore.getState().actions.setAssetsQuota(1024);
    expect(useCacheStore.getState().settings.assetsQuota).toBe(1024);
  });

  it("setLruQuota updates settings", () => {
    useCacheStore.getState().actions.setLruQuota(2048);
    expect(useCacheStore.getState().settings.lruQuota).toBe(2048);
  });

  it("setSmartRules merges partial smart rules", () => {
    useCacheStore.getState().actions.setSmartRules({ enabled: true });
    const rules = useCacheStore.getState().settings.smartRules;
    expect(rules.enabled).toBe(true);
    expect(rules.favoriteSongs).toBe(true);
  });

  it("setLibraryCaching enables both libraryCaching and syncLibrary", () => {
    useCacheStore.getState().actions.setLibraryCaching(true);
    const state = useCacheStore.getState();
    expect(state.settings.libraryCaching).toBe(true);
    expect(state.settings.syncLibrary).toBe(true);
  });

  it("setLibraryCaching(false) disables both libraryCaching and syncLibrary", () => {
    useCacheStore.getState().actions.setLibraryCaching(true);
    useCacheStore.getState().actions.setLibraryCaching(false);
    const state = useCacheStore.getState();
    expect(state.settings.libraryCaching).toBe(false);
    expect(state.settings.syncLibrary).toBe(false);
  });

  it("setSyncCoverArt updates settings", () => {
    useCacheStore.getState().actions.setSyncCoverArt(true);
    expect(useCacheStore.getState().settings.syncCoverArt).toBe(true);
  });

  it("setCoverArtConcurrency clamps between min and max", () => {
    useCacheStore.getState().actions.setCoverArtConcurrency(0);
    expect(useCacheStore.getState().settings.coverArtConcurrency).toBe(1);

    useCacheStore.getState().actions.setCoverArtConcurrency(100);
    expect(useCacheStore.getState().settings.coverArtConcurrency).toBe(8);

    useCacheStore.getState().actions.setCoverArtConcurrency(4);
    expect(useCacheStore.getState().settings.coverArtConcurrency).toBe(4);
  });

  it("setIsOnline updates status", () => {
    useCacheStore.getState().actions.setIsOnline(false);
    expect(useCacheStore.getState().status.isOnline).toBe(false);
  });

  it("setIsMetered updates status", () => {
    useCacheStore.getState().actions.setIsMetered(true);
    expect(useCacheStore.getState().status.isMetered).toBe(true);
  });

  it("updateCacheStats updates all cache stats", () => {
    useCacheStore.getState().actions.updateCacheStats({
      audioSize: 1000,
      coverSize: 500,
      audioCount: 10,
      coverCount: 5,
    });
    const status = useCacheStore.getState().status;
    expect(status.currentAudioCacheSize).toBe(1000);
    expect(status.currentCoverCacheSize).toBe(500);
    expect(status.audioCachedCount).toBe(10);
    expect(status.coverCachedCount).toBe(5);
  });

  it("updateSyncState merges partial state", () => {
    useCacheStore.getState().actions.updateSyncState({
      phase: "songs",
      tier: "t3",
      progress: 50,
      isSyncing: true,
    });
    const syncState = useCacheStore.getState().status.syncState;
    expect(syncState.phase).toBe("songs");
    expect(syncState.tier).toBe("t3");
    expect(syncState.progress).toBe(50);
    expect(syncState.isSyncing).toBe(true);
    expect(syncState.totalItems).toBe(0);
  });

  it("setLastSyncedAt updates timestamp", () => {
    const ts = Date.now();
    useCacheStore.getState().actions.setLastSyncedAt(ts);
    expect(useCacheStore.getState().status.lastSyncedAt).toBe(ts);
  });
});
