import { clear as idbClear, set as idbSet } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { cacheIndexStore } from "@/store/idb";
import { _resetLibraryDbForTests, libraryDb } from "@/store/library-db";
import { useCacheIndexStore, isAudioCached, isCoverCached, computePoolStats } from "./cache-index.store";

const INDEX_KEY = "cache-index-v1";

beforeEach(async () => {
  await idbClear(cacheIndexStore);
  await _resetLibraryDbForTests();
  useCacheIndexStore.setState({ items: {}, loaded: false, downloads: {} });
});

describe("cache-index.store · loadFromIDB", () => {
  it("migrates legacy entries missing `source` to explicit", async () => {
    await idbSet(
      INDEX_KEY,
      {
        "audio/legacy": {
          id: "legacy",
          type: "audio",
          sizeBytes: 1024,
          cachedAt: 1,
          lastAccessedAt: 1,
          // no `source` — simulates a pre-P2.1 entry
        },
      },
      cacheIndexStore,
    );

    await useCacheIndexStore.getState().actions.loadFromIDB();

    const items = useCacheIndexStore.getState().items;
    expect(items["audio/legacy"]?.source).toBe("explicit");
    expect(items["audio/legacy"]?.sizeBytes).toBe(1024);
  });

  it("preserves the existing source field when present", async () => {
    await idbSet(
      INDEX_KEY,
      {
        "audio/smart": {
          id: "smart",
          type: "audio",
          source: "smart",
          triggers: ["favorite"],
          sizeBytes: 2048,
          cachedAt: 2,
          lastAccessedAt: 2,
        },
        "audio/lru": {
          id: "lru",
          type: "audio",
          source: "lru",
          sizeBytes: 512,
          cachedAt: 3,
          lastAccessedAt: 3,
        },
      },
      cacheIndexStore,
    );

    await useCacheIndexStore.getState().actions.loadFromIDB();

    const items = useCacheIndexStore.getState().items;
    expect(items["audio/smart"]?.source).toBe("smart");
    expect(items["audio/smart"]?.triggers).toEqual(["favorite"]);
    expect(items["audio/lru"]?.source).toBe("lru");
  });

  it("restores cached audio from libraryDb.cacheMeta when legacy index is empty", async () => {
    await libraryDb.cacheMeta.put({
      key: "audio:dexie-song",
      id: "dexie-song",
      type: "audio",
      source: "explicit",
      sizeBytes: 8192,
      cachedAt: 10,
      lastAccessedAt: 11,
    });

    await useCacheIndexStore.getState().actions.loadFromIDB();

    const item = useCacheIndexStore.getState().items["audio:dexie-song"];
    expect(item).toMatchObject({
      id: "dexie-song",
      type: "audio",
      source: "explicit",
      sizeBytes: 8192,
    });
  });

  it("prefers cacheMeta rows over legacy rows and keeps metadata fields", async () => {
    await idbSet(
      INDEX_KEY,
      {
        "audio:smart": {
          id: "smart",
          type: "audio",
          source: "explicit",
          sizeBytes: 1024,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
        "cover:cover-1": {
          id: "cover-1",
          type: "cover",
          source: "explicit",
          coverSize: "300",
          sizeBytes: 300,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      cacheIndexStore,
    );
    await libraryDb.cacheMeta.bulkPut([
      {
        key: "audio:smart",
        id: "smart",
        type: "audio",
        source: "smart",
        triggers: ["favorite"],
        sizeBytes: 4096,
        cachedAt: 4,
        lastAccessedAt: 5,
        removedFromServer: true,
      },
      {
        key: "cover:cover-1",
        id: "cover-1",
        type: "cover",
        source: "explicit",
        coverSize: "700",
        sizeBytes: 700,
        cachedAt: 6,
        lastAccessedAt: 7,
      },
    ]);

    await useCacheIndexStore.getState().actions.loadFromIDB();

    const items = useCacheIndexStore.getState().items;
    expect(items["audio:smart"]).toMatchObject({
      source: "smart",
      triggers: ["favorite"],
      removedFromServer: true,
      sizeBytes: 4096,
    });
    expect(items["cover:cover-1"]).toMatchObject({
      coverSize: "700",
      sizeBytes: 700,
    });
  });

  it("marks the store as loaded without clearing current items when IDB is empty", async () => {
    useCacheIndexStore.getState().actions.addItem("audio:new-song", {
      id: "new-song",
      type: "audio",
      source: "explicit",
      sizeBytes: 4096,
      cachedAt: 4,
      lastAccessedAt: 4,
    });

    await useCacheIndexStore.getState().actions.loadFromIDB();

    expect(useCacheIndexStore.getState().loaded).toBe(true);
    expect(useCacheIndexStore.getState().items["audio:new-song"]).toMatchObject(
      {
        id: "new-song",
        source: "explicit",
      },
    );
  });

  it("merges persisted entries with items added before load finishes", async () => {
    await idbSet(
      INDEX_KEY,
      {
        "audio:stored-song": {
          id: "stored-song",
          type: "audio",
          source: "explicit",
          sizeBytes: 1024,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      cacheIndexStore,
    );

    useCacheIndexStore.getState().actions.addItem("audio:new-song", {
      id: "new-song",
      type: "audio",
      source: "explicit",
      sizeBytes: 4096,
      cachedAt: 4,
      lastAccessedAt: 4,
    });

    await useCacheIndexStore.getState().actions.loadFromIDB();

    const items = useCacheIndexStore.getState().items;
    expect(items["audio:stored-song"]?.id).toBe("stored-song");
    expect(items["audio:new-song"]?.id).toBe("new-song");
  });

  it("keeps current in-memory entries when persisted keys conflict", async () => {
    await idbSet(
      INDEX_KEY,
      {
        "audio:conflict": {
          id: "conflict",
          type: "audio",
          source: "explicit",
          sizeBytes: 1024,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      cacheIndexStore,
    );
    await libraryDb.cacheMeta.put({
      key: "audio:conflict",
      id: "conflict",
      type: "audio",
      source: "explicit",
      sizeBytes: 2048,
      cachedAt: 2,
      lastAccessedAt: 2,
    });

    useCacheIndexStore.getState().actions.addItem("audio:conflict", {
      id: "conflict",
      type: "audio",
      source: "smart",
      triggers: ["favorite"],
      sizeBytes: 4096,
      cachedAt: 4,
      lastAccessedAt: 4,
    });

    await useCacheIndexStore.getState().actions.loadFromIDB();

    const item = useCacheIndexStore.getState().items["audio:conflict"];
    expect(item?.source).toBe("smart");
    expect(item?.triggers).toEqual(["favorite"]);
    expect(item?.sizeBytes).toBe(4096);
  });
});

describe("cache-index.store · actions", () => {
  it("addItem respects the provided source", () => {
    const { addItem } = useCacheIndexStore.getState().actions;

    addItem("audio/1", {
      id: "1",
      type: "audio",
      source: "explicit",
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    });
    addItem("audio/2", {
      id: "2",
      type: "audio",
      source: "smart",
      triggers: ["frequent"],
      sizeBytes: 200,
      cachedAt: 2,
      lastAccessedAt: 2,
    });
    addItem("audio/3", {
      id: "3",
      type: "audio",
      source: "lru",
      sizeBytes: 300,
      cachedAt: 3,
      lastAccessedAt: 3,
    });

    const items = useCacheIndexStore.getState().items;
    expect(items["audio/1"]?.source).toBe("explicit");
    expect(items["audio/2"]?.source).toBe("smart");
    expect(items["audio/2"]?.triggers).toEqual(["frequent"]);
    expect(items["audio/3"]?.source).toBe("lru");
  });

  it("touchItem updates lastAccessedAt without losing source", () => {
    const { addItem, touchItem } = useCacheIndexStore.getState().actions;

    addItem("audio/1", {
      id: "1",
      type: "audio",
      source: "smart",
      triggers: ["favorite"],
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    });

    const before = useCacheIndexStore.getState().items["audio/1"];
    touchItem("audio/1");
    const after = useCacheIndexStore.getState().items["audio/1"];

    expect(after?.source).toBe("smart");
    expect(after?.triggers).toEqual(["favorite"]);
    expect(after?.lastAccessedAt).toBeGreaterThanOrEqual(
      before?.lastAccessedAt ?? 0,
    );
  });
});

describe("cache-index.store · setRemovedFromServer", () => {
  beforeEach(() => {
    useCacheIndexStore.setState({ items: {}, loaded: true, downloads: {} });
  });

  it("sets removedFromServer to true", () => {
    const { addItem } = useCacheIndexStore.getState().actions;
    addItem("audio:s1", {
      id: "s1",
      type: "audio",
      source: "explicit",
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    });

    useCacheIndexStore.getState().actions.setRemovedFromServer("audio:s1", true);
    expect(useCacheIndexStore.getState().items["audio:s1"].removedFromServer).toBe(true);
  });

  it("removes removedFromServer when set to false", () => {
    const { addItem } = useCacheIndexStore.getState().actions;
    addItem("audio:s2", {
      id: "s2",
      type: "audio",
      source: "explicit",
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
      removedFromServer: true,
    });

    useCacheIndexStore.getState().actions.setRemovedFromServer("audio:s2", false);
    const item = useCacheIndexStore.getState().items["audio:s2"];
    expect(item.removedFromServer).toBeUndefined();
  });

  it("no-ops for nonexistent key", () => {
    useCacheIndexStore.getState().actions.setRemovedFromServer("audio:missing", true);
    expect(useCacheIndexStore.getState().items["audio:missing"]).toBeUndefined();
  });
});

describe("cache-index.store · clear", () => {
  it("clears all items", () => {
    useCacheIndexStore.setState({
      items: {
        "audio/x": {
          id: "x",
          type: "audio",
          source: "explicit",
          sizeBytes: 10,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    useCacheIndexStore.getState().actions.clear();
    expect(useCacheIndexStore.getState().items).toEqual({});
  });
});

describe("cache-index.store · download progress", () => {
  it("setDownloadProgress sets a value", () => {
    useCacheIndexStore.setState({ downloads: {} });
    useCacheIndexStore.getState().actions.setDownloadProgress("s1", 50);
    expect(useCacheIndexStore.getState().downloads.s1).toBe(50);
  });

  it("clearDownloadProgress removes the entry", () => {
    useCacheIndexStore.setState({ downloads: { s1: 75 } });
    useCacheIndexStore.getState().actions.clearDownloadProgress("s1");
    expect(useCacheIndexStore.getState().downloads.s1).toBeUndefined();
  });

  it("setDownloadProgress with negative bytes for indeterminate progress", () => {
    useCacheIndexStore.setState({ downloads: {} });
    useCacheIndexStore.getState().actions.setDownloadProgress("s1", -1024);
    expect(useCacheIndexStore.getState().downloads.s1).toBe(-1024);
  });
});

describe("cache-index.store · helper functions", () => {
  beforeEach(() => {
    useCacheIndexStore.setState({ items: {}, loaded: true, downloads: {} });
  });

  it("isAudioCached returns true for existing audio key", () => {
    useCacheIndexStore.getState().actions.addItem("audio:song-1", {
      id: "song-1",
      type: "audio",
      source: "explicit",
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    });
    expect(isAudioCached("song-1")).toBe(true);
    expect(isAudioCached("unknown")).toBe(false);
    expect(isCoverCached("song-1")).toBe(false);
  });

  it("isCoverCached returns true for existing cover key", () => {
    useCacheIndexStore.getState().actions.addItem("cover:art-1", {
      id: "art-1",
      type: "cover",
      source: "explicit",
      sizeBytes: 200,
      cachedAt: 1,
      lastAccessedAt: 1,
    });
    expect(isCoverCached("art-1")).toBe(true);
    expect(isCoverCached("missing")).toBe(false);
    expect(isAudioCached("art-1")).toBe(false);
  });
});

describe("cache-index.store · computePoolStats", () => {
  it("groups audio by source and covers separately", () => {
    useCacheIndexStore.setState({
      items: {
        "audio:e1": {
          id: "e1",
          type: "audio",
          source: "explicit",
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
        "audio:s1": {
          id: "s1",
          type: "audio",
          source: "smart",
          triggers: ["fav"],
          sizeBytes: 200,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
        "audio:l1": {
          id: "l1",
          type: "audio",
          source: "lru",
          sizeBytes: 300,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
        "cover:c1": {
          id: "c1",
          type: "cover",
          source: "explicit",
          sizeBytes: 400,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    const stats = computePoolStats(useCacheIndexStore.getState().items);
    expect(stats.explicit).toEqual({ sizeBytes: 100, count: 1 });
    expect(stats.smart).toEqual({ sizeBytes: 200, count: 1 });
    expect(stats.lru).toEqual({ sizeBytes: 300, count: 1 });
    expect(stats.assets).toEqual({ sizeBytes: 400, count: 1 });
  });

  it("returns empty breakdowns for empty items", () => {
    useCacheIndexStore.setState({ items: {}, loaded: true });

    const stats = computePoolStats(useCacheIndexStore.getState().items);
    expect(stats.explicit).toEqual({ sizeBytes: 0, count: 0 });
    expect(stats.smart).toEqual({ sizeBytes: 0, count: 0 });
    expect(stats.lru).toEqual({ sizeBytes: 0, count: 0 });
    expect(stats.assets).toEqual({ sizeBytes: 0, count: 0 });
  });

  it("counts album and playlist items as explicit audio in pool stats", () => {
    useCacheIndexStore.setState({
      items: {
        "album:al1": {
          id: "al1",
          type: "album",
          source: "explicit",
          sizeBytes: 100,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
        "playlist:pl1": {
          id: "pl1",
          type: "playlist",
          source: "explicit",
          sizeBytes: 200,
          cachedAt: 1,
          lastAccessedAt: 1,
        },
      },
      loaded: true,
    });

    const stats = computePoolStats(useCacheIndexStore.getState().items);
    expect(stats.explicit).toEqual({ sizeBytes: 300, count: 2 });
    expect(stats.smart).toEqual({ sizeBytes: 0, count: 0 });
    expect(stats.lru).toEqual({ sizeBytes: 0, count: 0 });
    expect(stats.assets).toEqual({ sizeBytes: 0, count: 0 });
  });
});

describe("cache-index.store · removeItem", () => {
  it("removes an item from the index", () => {
    const { addItem, removeItem } = useCacheIndexStore.getState().actions;
    addItem("audio:rm1", {
      id: "rm1",
      type: "audio",
      source: "explicit",
      sizeBytes: 100,
      cachedAt: 1,
      lastAccessedAt: 1,
    });
    expect(useCacheIndexStore.getState().items["audio:rm1"]).toBeDefined();

    removeItem("audio:rm1");
    expect(useCacheIndexStore.getState().items["audio:rm1"]).toBeUndefined();
  });
});
