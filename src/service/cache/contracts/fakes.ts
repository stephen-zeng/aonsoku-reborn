import type { CachedItemMeta, CacheTask } from "@/types/cache";
import type {
  AudioDownloadQueue,
  AudioDownloadService,
  AudioSourceDescriptor,
  AudioSourceResolver,
  CacheAudioPurpose,
  CacheAudioUrlResolver,
  CacheIndexAdapter,
  CacheIndexSnapshot,
  CacheItemKey,
  CacheMetadataPersistence,
  CacheMetadataRecord,
  CacheStorageAdapter,
  NativeCacheAdapter,
  NativeCachedAudioFile,
  NativeFileResolver,
} from "./index";

export class FakeCacheStorage implements CacheStorageAdapter {
  readonly entries = new Map<CacheItemKey, Blob>();

  async put(key: CacheItemKey, data: Blob, contentType: string): Promise<void> {
    this.entries.set(key, data.slice(0, data.size, contentType));
  }

  async get(key: CacheItemKey): Promise<Blob | null> {
    return this.entries.get(key) ?? null;
  }

  async delete(key: CacheItemKey): Promise<boolean> {
    return this.entries.delete(key);
  }

  async has(key: CacheItemKey): Promise<boolean> {
    return this.entries.has(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  async keys(): Promise<CacheItemKey[]> {
    return Array.from(this.entries.keys());
  }
}

export class FakeCacheIndex implements CacheIndexAdapter {
  readonly downloads: Record<string, number> = {};
  private readonly items: Record<CacheItemKey, CachedItemMeta>;
  private loaded: boolean;
  private readonly now: () => number;

  constructor(
    options: {
      items?: Record<CacheItemKey, CachedItemMeta>;
      loaded?: boolean;
      now?: () => number;
    } = {},
  ) {
    this.items = { ...options.items };
    this.loaded = options.loaded ?? true;
    this.now = options.now ?? Date.now;
  }

  getSnapshot(): CacheIndexSnapshot {
    return {
      items: { ...this.items },
      loaded: this.loaded,
    };
  }

  setLoaded(loaded: boolean): void {
    this.loaded = loaded;
  }

  getItem(key: CacheItemKey): CachedItemMeta | undefined {
    return this.items[key];
  }

  hasItem(key: CacheItemKey): boolean {
    return key in this.items;
  }

  addItem(key: CacheItemKey, meta: CachedItemMeta): void {
    this.items[key] = { ...meta };
  }

  removeItem(key: CacheItemKey): void {
    delete this.items[key];
  }

  touchItem(key: CacheItemKey): void {
    const item = this.items[key];
    if (!item) return;
    item.lastAccessedAt = this.now();
  }

  setRemovedFromServer(key: CacheItemKey, removed: boolean): void {
    const item = this.items[key];
    if (!item) return;
    if (removed) {
      item.removedFromServer = true;
    } else {
      delete item.removedFromServer;
    }
  }

  clear(): void {
    for (const key of Object.keys(this.items)) {
      delete this.items[key];
    }
  }

  setDownloadProgress(songId: string, progress: number): void {
    this.downloads[songId] = progress;
  }

  clearDownloadProgress(songId: string): void {
    delete this.downloads[songId];
  }
}

export class FakeCacheMetadataPersistence implements CacheMetadataPersistence {
  readonly records = new Map<CacheItemKey, CacheMetadataRecord>();

  async get(key: CacheItemKey): Promise<CacheMetadataRecord | undefined> {
    return this.records.get(key);
  }

  async list(): Promise<CacheMetadataRecord[]> {
    return Array.from(this.records.values());
  }

  async put(key: CacheItemKey, meta: CacheMetadataRecord): Promise<void> {
    this.records.set(key, { ...meta, key });
  }

  async delete(key: CacheItemKey): Promise<void> {
    this.records.delete(key);
  }

  async bulkDelete(keys: CacheItemKey[]): Promise<void> {
    for (const key of keys) {
      this.records.delete(key);
    }
  }
}

export class FakeAudioDownloadService implements AudioDownloadService {
  readonly tasks: CacheTask[] = [];
  private readonly queued = new Set<string>();
  private readonly inFlight = new Set<string>();
  private readonly executor: (task: CacheTask) => Promise<void> | void;

  constructor(executor: (task: CacheTask) => Promise<void> | void = () => {}) {
    this.executor = executor;
  }

  async cacheSong(task: CacheTask): Promise<void> {
    this.queued.add(task.songId);
    this.queued.delete(task.songId);
    this.inFlight.add(task.songId);
    this.tasks.push(task);
    try {
      await this.executor(task);
    } finally {
      this.inFlight.delete(task.songId);
    }
  }

  cancelAll(): void {
    this.queued.clear();
    this.inFlight.clear();
  }

  isQueued(songId: string): boolean {
    return this.queued.has(songId);
  }

  isInFlight(songId: string): boolean {
    return this.inFlight.has(songId);
  }
}

export class FakeAudioDownloadQueue implements AudioDownloadQueue {
  readonly tasks: CacheTask[] = [];
  private readonly queued = new Set<string>();
  private readonly inFlight = new Set<string>();
  private readonly executor: (task: CacheTask) => Promise<void> | void;

  constructor(executor: (task: CacheTask) => Promise<void> | void = () => {}) {
    this.executor = executor;
  }

  async enqueue(task: CacheTask): Promise<void> {
    this.queued.add(task.songId);
    this.queued.delete(task.songId);
    this.inFlight.add(task.songId);
    this.tasks.push(task);
    try {
      await this.executor(task);
    } finally {
      this.inFlight.delete(task.songId);
    }
  }

  clear(): void {
    this.queued.clear();
    this.inFlight.clear();
  }

  isQueued(songId: string): boolean {
    return this.queued.has(songId);
  }

  isInFlight(songId: string): boolean {
    return this.inFlight.has(songId);
  }
}

export class FakeAudioUrlResolver implements CacheAudioUrlResolver {
  constructor(private readonly baseUrl = "https://example.test") {}

  buildAudioUrl(songId: string, purpose: CacheAudioPurpose): string {
    const url = `${this.baseUrl}/stream/${encodeURIComponent(songId)}?v=1`;
    return purpose === "cache" ? `${url}&_c=1` : url;
  }
}

export class FakeAudioSourceResolver implements AudioSourceResolver {
  private readonly sources = new Map<string, AudioSourceDescriptor>();
  private readonly urlResolver: CacheAudioUrlResolver;

  constructor(urlResolver: CacheAudioUrlResolver = new FakeAudioUrlResolver()) {
    this.urlResolver = urlResolver;
  }

  setSongSource(source: AudioSourceDescriptor): void {
    if (source.kind === "radio") return;
    this.sources.set(source.songId, source);
  }

  async resolveSongSource(songId: string): Promise<AudioSourceDescriptor> {
    return (
      this.sources.get(songId) ?? {
        kind: "stream",
        songId,
        url: this.urlResolver.buildAudioUrl(songId, "stream"),
      }
    );
  }

  resolveRadioSource(url: string, radioId?: string): AudioSourceDescriptor {
    return { kind: "radio", url, radioId };
  }
}

export class FakeNativeFileResolver implements NativeFileResolver {
  private readonly files = new Map<string, NativeCachedAudioFile>();

  setAudioFile(file: NativeCachedAudioFile): void {
    this.files.set(file.songId, file);
  }

  async resolveAudioFile(
    songId: string,
  ): Promise<NativeCachedAudioFile | null> {
    return this.files.get(songId) ?? null;
  }

  async deleteAudioFile(songId: string): Promise<boolean> {
    return this.files.delete(songId);
  }
}

export class FakeNativeCacheAdapter implements NativeCacheAdapter {
  private readonly files = new Map<
    string,
    NativeCachedAudioFile & { data: Blob }
  >();
  private nextId = 1;

  async storeAudioFile(
    songId: string,
    data: Blob,
    contentType: string,
  ): Promise<NativeCachedAudioFile> {
    const file: NativeCachedAudioFile & { data: Blob } = {
      songId,
      uri: `file:///native-cache/${songId}-${this.nextId++}`,
      contentType,
      sizeBytes: data.size,
      lastModifiedAt: Date.now(),
      data,
    };
    this.files.set(songId, file);
    const { data: _data, ...stored } = file;
    return stored;
  }

  async resolveAudioFile(
    songId: string,
  ): Promise<NativeCachedAudioFile | null> {
    const file = this.files.get(songId);
    if (!file) return null;
    const { data: _data, ...stored } = file;
    return stored;
  }

  async getAudioFileSize(songId: string): Promise<number | null> {
    const file = this.files.get(songId);
    return file?.sizeBytes ?? null;
  }

  async deleteAudioFile(songId: string): Promise<boolean> {
    return this.files.delete(songId);
  }

  async evictAudioFile(songId: string): Promise<boolean> {
    return this.files.delete(songId);
  }

  async clearAudioFiles(): Promise<void> {
    this.files.clear();
  }
}
