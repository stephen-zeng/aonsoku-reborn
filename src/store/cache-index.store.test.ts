import { clear as idbClear, set as idbSet } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { cacheIndexStore } from "@/store/idb";
import { useCacheIndexStore } from "./cache-index.store";

const INDEX_KEY = "cache-index-v1";

beforeEach(async () => {
  await idbClear(cacheIndexStore);
  useCacheIndexStore.setState({ items: {}, loaded: false });
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
