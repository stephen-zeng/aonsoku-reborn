import { describe, expect, it } from "vitest";
import { audioKey } from "../cache-keys";
import {
  FakeAudioUrlResolver,
  FakeCacheIndex,
  FakeCacheMetadataPersistence,
  FakeCacheStorage,
  FakeNativeCacheAdapter,
  FakeNativeFileResolver,
} from "../contracts/fakes";
import { CacheAudioSourceResolver, getAudioSourceUrl } from "./resolver";

function audioMeta(overrides = {}) {
  return {
    id: "song-1",
    type: "audio" as const,
    source: "explicit" as const,
    sizeBytes: 5,
    cachedAt: 1,
    lastAccessedAt: 1,
    ...overrides,
  };
}

function createBlobUrls() {
  const revoked: string[] = [];
  let nextId = 1;

  return {
    revoked,
    adapter: {
      createObjectURL: () => `blob:test-${nextId++}`,
      revokeObjectURL: (url: string) => {
        revoked.push(url);
      },
    },
  };
}

function createResolver(options: {
  storage?: FakeCacheStorage;
  index?: FakeCacheIndex;
  metadata?: FakeCacheMetadataPersistence;
  nativeFileResolver?: FakeNativeFileResolver | FakeNativeCacheAdapter;
  now?: () => number;
} = {}) {
  const blobUrls = createBlobUrls();
  const resolver = new CacheAudioSourceResolver({
    storage: options.storage ?? new FakeCacheStorage(),
    index: options.index ?? new FakeCacheIndex(),
    metadata: options.metadata ?? new FakeCacheMetadataPersistence(),
    nativeFileResolver: options.nativeFileResolver,
    urlResolver: new FakeAudioUrlResolver("https://music.test"),
    blobUrls: blobUrls.adapter,
    now: options.now ?? (() => 50),
  });

  return { resolver, blobUrls };
}

describe("CacheAudioSourceResolver", () => {
  it("returns a blob descriptor for a cache hit", async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeCacheIndex({
      items: {
        [audioKey("song-1")]: audioMeta(),
      },
      now: () => 77,
    });
    await storage.put(audioKey("song-1"), new Blob(["audio"]), "audio/mpeg");
    const { resolver, blobUrls } = createResolver({ storage, index });

    const source = await resolver.resolveSongSource("song-1");

    expect(source).toMatchObject({
      kind: "blob",
      songId: "song-1",
      url: "blob:test-1",
    });
    expect(index.getItem(audioKey("song-1"))?.lastAccessedAt).toBe(77);
    source.revoke?.();
    expect(blobUrls.revoked).toEqual(["blob:test-1"]);
  });

  it("returns a stream descriptor when the loaded index has no cache entry", async () => {
    const storage = new FakeCacheStorage();
    await storage.put(audioKey("song-1"), new Blob(["audio"]), "audio/mpeg");
    const index = new FakeCacheIndex({ loaded: true });
    const { resolver } = createResolver({ storage, index });

    const source = await resolver.resolveSongSource("song-1");

    expect(source).toEqual({
      kind: "stream",
      songId: "song-1",
      url: "https://music.test/stream/song-1?v=1",
    });
  });

  it("removes stale index entries when the cached blob is missing", async () => {
    const index = new FakeCacheIndex({
      items: {
        [audioKey("stale")]: audioMeta({ id: "stale" }),
      },
    });
    const { resolver } = createResolver({ index });

    const source = await resolver.resolveSongSource("stale");

    expect(source).toEqual({
      kind: "stream",
      songId: "stale",
      url: "https://music.test/stream/stale?v=1",
    });
    expect(index.hasItem(audioKey("stale"))).toBe(false);
  });

  it("recovers metadata on the index-not-loaded slow path", async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeCacheIndex({ loaded: false });
    const metadata = new FakeCacheMetadataPersistence();
    await storage.put(audioKey("song-1"), new Blob(["audio"]), "audio/mpeg");
    await metadata.put(audioKey("song-1"), {
      key: audioKey("song-1"),
      ...audioMeta({
        source: "smart",
        triggers: ["favorite"],
        lastAccessedAt: 2,
      }),
    });
    const { resolver } = createResolver({
      storage,
      index,
      metadata,
      now: () => 99,
    });

    const source = await resolver.resolveSongSource("song-1");

    expect(source.kind).toBe("blob");
    expect(index.getItem(audioKey("song-1"))).toEqual({
      ...audioMeta({
        source: "smart",
        triggers: ["favorite"],
        lastAccessedAt: 99,
      }),
    });
  });

  it("writes synthetic metadata when a startup blob has no saved row", async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeCacheIndex({ loaded: false });
    const metadata = new FakeCacheMetadataPersistence();
    await storage.put(audioKey("song-1"), new Blob(["audio"]), "audio/mpeg");
    const { resolver } = createResolver({
      storage,
      index,
      metadata,
      now: () => 123,
    });

    const source = await resolver.resolveSongSource("song-1");

    expect(source.kind).toBe("blob");
    expect(await metadata.get(audioKey("song-1"))).toEqual({
      key: audioKey("song-1"),
      id: "song-1",
      type: "audio",
      source: "explicit",
      sizeBytes: 5,
      cachedAt: 123,
      lastAccessedAt: 123,
    });
  });

  it("returns a native-file descriptor when a native resolver has a file", async () => {
    const nativeFileResolver = new FakeNativeFileResolver();
    nativeFileResolver.setAudioFile({
      songId: "song-1",
      uri: "file:///cache/song-1.flac",
    });
    const { resolver } = createResolver({ nativeFileResolver });

    const source = await resolver.resolveSongSource("song-1");

    expect(source).toEqual({
      kind: "native-file",
      songId: "song-1",
      uri: "file:///cache/song-1.flac",
    });
    expect(getAudioSourceUrl(source)).toBe("file:///cache/song-1.flac");
  });

  it("returns a native-file descriptor when a NativeCacheAdapter has stored a file", async () => {
    const nativeCacheAdapter = new FakeNativeCacheAdapter();
    await nativeCacheAdapter.storeAudioFile(
      "song-1",
      new Blob(["audio data"]),
      "audio/mpeg",
    );
    const { resolver } = createResolver({ nativeFileResolver: nativeCacheAdapter });

    const source = await resolver.resolveSongSource("song-1");

    expect(source.kind).toBe("native-file");
    expect(source).toMatchObject({
      kind: "native-file",
      songId: "song-1",
    });
    if (source.kind === "native-file") {
      expect(typeof source.uri).toBe("string");
      expect(source.uri.length).toBeGreaterThan(0);
    }
  });

  it("prefers native-file over cached blob when both exist", async () => {
    const storage = new FakeCacheStorage();
    const index = new FakeCacheIndex({
      items: { [audioKey("song-1")]: audioMeta() },
    });
    await storage.put(audioKey("song-1"), new Blob(["web audio"]), "audio/mpeg");

    const nativeCacheAdapter = new FakeNativeCacheAdapter();
    await nativeCacheAdapter.storeAudioFile(
      "song-1",
      new Blob(["native audio"]),
      "audio/mpeg",
    );
    const { resolver } = createResolver({
      storage,
      index,
      nativeFileResolver: nativeCacheAdapter,
    });

    const source = await resolver.resolveSongSource("song-1");

    expect(source.kind).toBe("native-file");
  });
});
