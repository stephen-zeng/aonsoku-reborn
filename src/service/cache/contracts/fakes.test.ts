import { describe, expect, it } from "vitest";
import { Priority, type CacheTask } from "@/types/cache";
import {
  FakeAudioDownloadQueue,
  FakeAudioDownloadService,
  FakeAudioSourceResolver,
  FakeAudioUrlResolver,
  FakeCacheIndex,
  FakeCacheMetadataPersistence,
  FakeCacheStorage,
  FakeNativeCacheAdapter,
  FakeNativeFileResolver,
} from "./fakes";

function audioMeta(overrides = {}) {
  return {
    id: "song-1",
    type: "audio" as const,
    source: "explicit" as const,
    sizeBytes: 10,
    cachedAt: 1,
    lastAccessedAt: 1,
    ...overrides,
  };
}

describe("FakeCacheStorage", () => {
  it("round-trips blobs and reports keys", async () => {
    const storage = new FakeCacheStorage();
    await storage.put("audio:song-1", new Blob(["abc"]), "audio/mpeg");

    expect(await storage.has("audio:song-1")).toBe(true);
    expect(await storage.keys()).toEqual(["audio:song-1"]);
    expect(await (await storage.get("audio:song-1"))?.text()).toBe("abc");
  });

  it("deletes and clears entries", async () => {
    const storage = new FakeCacheStorage();
    await storage.put("a", new Blob(["a"]), "text/plain");
    await storage.put("b", new Blob(["b"]), "text/plain");

    expect(await storage.delete("a")).toBe(true);
    expect(await storage.delete("missing")).toBe(false);
    await storage.clear();

    expect(await storage.keys()).toEqual([]);
  });
});

describe("FakeCacheIndex", () => {
  it("tracks metadata, touches access time, and exposes snapshots", () => {
    const index = new FakeCacheIndex({ loaded: false, now: () => 42 });

    index.addItem("audio:song-1", audioMeta());
    index.touchItem("audio:song-1");
    index.setLoaded(true);

    expect(index.hasItem("audio:song-1")).toBe(true);
    expect(index.getItem("audio:song-1")?.lastAccessedAt).toBe(42);
    expect(index.getSnapshot()).toEqual({
      items: {
        "audio:song-1": {
          ...audioMeta(),
          lastAccessedAt: 42,
        },
      },
      loaded: true,
    });
  });

  it("tracks removed flags and download progress", () => {
    const index = new FakeCacheIndex();
    index.addItem("audio:song-1", audioMeta());

    index.setRemovedFromServer("audio:song-1", true);
    index.setDownloadProgress("song-1", 50);

    expect(index.getItem("audio:song-1")?.removedFromServer).toBe(true);
    expect(index.downloads["song-1"]).toBe(50);

    index.setRemovedFromServer("audio:song-1", false);
    index.clearDownloadProgress("song-1");
    index.removeItem("audio:song-1");

    expect(index.getItem("audio:song-1")).toBeUndefined();
    expect(index.downloads["song-1"]).toBeUndefined();
  });
});

describe("FakeCacheMetadataPersistence", () => {
  it("persists, lists, and deletes metadata records", async () => {
    const persistence = new FakeCacheMetadataPersistence();
    const record = { key: "audio:song-1", ...audioMeta() };

    await persistence.put("audio:song-1", record);
    expect(await persistence.get("audio:song-1")).toEqual(record);
    expect(await persistence.list()).toEqual([record]);

    await persistence.bulkDelete(["audio:song-1"]);
    expect(await persistence.get("audio:song-1")).toBeUndefined();
  });

  it("normalizes the stored key from the put key", async () => {
    const persistence = new FakeCacheMetadataPersistence();

    await persistence.put("audio:canonical", {
      key: "audio:other",
      ...audioMeta({ id: "canonical" }),
    });

    expect(await persistence.get("audio:canonical")).toMatchObject({
      key: "audio:canonical",
      id: "canonical",
    });
  });
});

describe("FakeAudioDownloadService", () => {
  it("records tasks and reports in-flight downloads", async () => {
    let finishDownload = () => {};
    const pending = new Promise<void>((resolve) => {
      finishDownload = resolve;
    });
    const service = new FakeAudioDownloadService(() => pending);
    const task: CacheTask = {
      songId: "song-1",
      priority: Priority.Explicit,
      source: "explicit",
    };

    const download = service.cacheSong(task);

    expect(service.tasks).toEqual([task]);
    expect(service.isInFlight("song-1")).toBe(true);

    finishDownload();
    await download;

    expect(service.isInFlight("song-1")).toBe(false);
  });
});

describe("FakeAudioDownloadQueue", () => {
  it("records queued tasks and reports in-flight work", async () => {
    let finishDownload = () => {};
    const pending = new Promise<void>((resolve) => {
      finishDownload = resolve;
    });
    const queue = new FakeAudioDownloadQueue(() => pending);
    const task: CacheTask = {
      songId: "queued-song",
      priority: Priority.Background,
      source: "smart",
      triggers: ["favorite"],
    };

    const download = queue.enqueue(task);

    expect(queue.tasks).toEqual([task]);
    expect(queue.isInFlight("queued-song")).toBe(true);

    queue.clear();
    expect(queue.isInFlight("queued-song")).toBe(false);

    finishDownload();
    await download;
  });
});

describe("fake audio source and native file resolvers", () => {
  it("builds stream URLs and resolves configured song sources", async () => {
    const urlResolver = new FakeAudioUrlResolver("https://music.test");
    const sourceResolver = new FakeAudioSourceResolver(urlResolver);

    expect(urlResolver.buildAudioUrl("song 1", "cache")).toBe(
      "https://music.test/stream/song%201?v=1&_c=1",
    );
    expect(await sourceResolver.resolveSongSource("song 1")).toEqual({
      kind: "stream",
      songId: "song 1",
      url: "https://music.test/stream/song%201?v=1",
    });

    sourceResolver.setSongSource({
      kind: "native-file",
      songId: "song 1",
      uri: "file:///song-1.flac",
    });

    expect(await sourceResolver.resolveSongSource("song 1")).toEqual({
      kind: "native-file",
      songId: "song 1",
      uri: "file:///song-1.flac",
    });
  });

  it("resolves and deletes native files", async () => {
    const resolver = new FakeNativeFileResolver();
    resolver.setAudioFile({
      songId: "song-1",
      uri: "file:///cache/song-1.mp3",
      sizeBytes: 123,
    });

    expect(await resolver.resolveAudioFile("song-1")).toEqual({
      songId: "song-1",
      uri: "file:///cache/song-1.mp3",
      sizeBytes: 123,
    });
    expect(await resolver.deleteAudioFile("song-1")).toBe(true);
    expect(await resolver.resolveAudioFile("song-1")).toBeNull();
  });
});

describe("FakeNativeCacheAdapter", () => {
  it("stores, resolves, and reports size of audio files", async () => {
    const adapter = new FakeNativeCacheAdapter();
    const data = new Blob(["audio data"], { type: "audio/mpeg" });

    const stored = await adapter.storeAudioFile("song-1", data, "audio/mpeg");

    expect(stored.songId).toBe("song-1");
    expect(stored.contentType).toBe("audio/mpeg");
    expect(stored.sizeBytes).toBe(data.size);
    expect(stored.uri).toMatch(/^file:\/\/\/native-cache\/song-1-/);

    const resolved = await adapter.resolveAudioFile("song-1");
    expect(resolved).not.toBeNull();
    expect(resolved!.songId).toBe("song-1");
    expect(resolved!.uri).toBe(stored.uri);

    const size = await adapter.getAudioFileSize("song-1");
    expect(size).toBe(data.size);
  });

  it("returns null for missing files", async () => {
    const adapter = new FakeNativeCacheAdapter();

    expect(await adapter.resolveAudioFile("missing")).toBeNull();
    expect(await adapter.getAudioFileSize("missing")).toBeNull();
  });

  it("deletes and evicts audio files", async () => {
    const adapter = new FakeNativeCacheAdapter();
    const data = new Blob(["audio"], { type: "audio/mpeg" });

    await adapter.storeAudioFile("song-1", data, "audio/mpeg");

    expect(await adapter.evictAudioFile("song-1")).toBe(true);
    expect(await adapter.resolveAudioFile("song-1")).toBeNull();

    await adapter.storeAudioFile("song-2", data, "audio/mpeg");
    expect(await adapter.deleteAudioFile("song-2")).toBe(true);
    expect(await adapter.resolveAudioFile("song-2")).toBeNull();
  });

  it("returns false for deleting or evicting missing files", async () => {
    const adapter = new FakeNativeCacheAdapter();

    expect(await adapter.deleteAudioFile("nope")).toBe(false);
    expect(await adapter.evictAudioFile("nope")).toBe(false);
  });

  it("overwrites existing files on store", async () => {
    const adapter = new FakeNativeCacheAdapter();
    const data1 = new Blob(["first"], { type: "audio/mpeg" });
    const data2 = new Blob(["second version"], { type: "audio/flac" });

    await adapter.storeAudioFile("song-1", data1, "audio/mpeg");
    const second = await adapter.storeAudioFile("song-1", data2, "audio/flac");

    expect(second.contentType).toBe("audio/flac");
    expect(second.sizeBytes).toBe(data2.size);

    const resolved = await adapter.resolveAudioFile("song-1");
    expect(resolved!.sizeBytes).toBe(data2.size);
  });

  it("clears all stored native audio files", async () => {
    const adapter = new FakeNativeCacheAdapter();
    await adapter.storeAudioFile("song-1", new Blob(["one"]), "audio/mpeg");
    await adapter.storeAudioFile("song-2", new Blob(["two"]), "audio/mpeg");

    await adapter.clearAudioFiles();

    expect(await adapter.resolveAudioFile("song-1")).toBeNull();
    expect(await adapter.resolveAudioFile("song-2")).toBeNull();
  });
});
