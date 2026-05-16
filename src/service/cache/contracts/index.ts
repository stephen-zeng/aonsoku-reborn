import type { CachedItemMeta, CacheTask } from "@/types/cache";

export type CacheItemKey = string;
export type CacheAudioPurpose = "cache" | "stream";
export type CacheMetadataRecord = CachedItemMeta & { key: CacheItemKey };

export interface CacheStorageAdapter {
  put(key: CacheItemKey, data: Blob, contentType: string): Promise<void>;
  get(key: CacheItemKey): Promise<Blob | null>;
  delete(key: CacheItemKey): Promise<boolean>;
  has(key: CacheItemKey): Promise<boolean>;
  clear(): Promise<void>;
  keys(): Promise<CacheItemKey[]>;
}

export interface CacheIndexSnapshot {
  items: Record<CacheItemKey, CachedItemMeta>;
  loaded: boolean;
}

export interface CacheIndexAdapter {
  getSnapshot(): CacheIndexSnapshot;
  getItem(key: CacheItemKey): CachedItemMeta | undefined;
  hasItem(key: CacheItemKey): boolean;
  addItem(key: CacheItemKey, meta: CachedItemMeta): void;
  removeItem(key: CacheItemKey): void;
  touchItem(key: CacheItemKey): void;
  setRemovedFromServer(key: CacheItemKey, removed: boolean): void;
  clear(): void;
  setDownloadProgress(songId: string, progress: number): void;
  clearDownloadProgress(songId: string): void;
}

export interface CacheMetadataPersistence {
  get(key: CacheItemKey): Promise<CacheMetadataRecord | undefined>;
  list(): Promise<CacheMetadataRecord[]>;
  put(key: CacheItemKey, meta: CacheMetadataRecord): Promise<void>;
  delete(key: CacheItemKey): Promise<void>;
  bulkDelete(keys: CacheItemKey[]): Promise<void>;
}

export interface AudioDownloadService {
  cacheSong(task: CacheTask): Promise<void>;
  cancelAll(): void;
  isQueued(songId: string): boolean;
  isInFlight(songId: string): boolean;
}

export interface AudioDownloadQueue {
  enqueue(task: CacheTask): Promise<void>;
  clear(): void;
  isQueued(songId: string): boolean;
  isInFlight(songId: string): boolean;
}

export interface CacheAudioUrlResolver {
  buildAudioUrl(songId: string, purpose: CacheAudioPurpose): string;
}

export type AudioSourceDescriptor =
  | {
      kind: "stream";
      songId: string;
      url: string;
    }
  | {
      kind: "blob";
      songId: string;
      url: string;
      revoke: () => void;
    }
  | {
      kind: "native-file";
      songId: string;
      uri: string;
    }
  | {
      kind: "radio";
      url: string;
      radioId?: string;
    };

export interface AudioSourceResolver {
  resolveSongSource(songId: string): Promise<AudioSourceDescriptor>;
  resolveRadioSource(url: string, radioId?: string): AudioSourceDescriptor;
}

export interface NativeCachedAudioFile {
  songId: string;
  uri: string;
  contentType?: string;
  sizeBytes?: number;
  lastModifiedAt?: number;
}

export interface NativeFileResolver {
  resolveAudioFile(songId: string): Promise<NativeCachedAudioFile | null>;
  deleteAudioFile(songId: string): Promise<boolean>;
}
