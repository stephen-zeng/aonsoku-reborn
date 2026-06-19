import type { CachedItemMeta } from "@/types/cache";
import { audioKey } from "../cache-keys";
import type {
  AudioSourceDescriptor,
  AudioSourceResolver,
  CacheAudioUrlResolver,
  CacheIndexAdapter,
  CacheMetadataPersistence,
  CacheMetadataRecord,
  CacheStorageAdapter,
  NativeCachedAudioFile,
  NativeFileResolver,
} from "../contracts";

export type BlobAudioSource = Extract<AudioSourceDescriptor, { kind: "blob" }>;

export interface BlobUrlAdapter {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface CacheAudioSourceResolverOptions {
  storage: CacheStorageAdapter;
  index: CacheIndexAdapter;
  metadata: CacheMetadataPersistence;
  urlResolver: CacheAudioUrlResolver;
  nativeFileResolver?: NativeFileResolver;
  blobUrls: BlobUrlAdapter;
  preferStreamOverBlob?: boolean;
  now?: () => number;
}

function cacheMetaFromRecord(
  record: CacheMetadataRecord,
  lastAccessedAt: number,
): CachedItemMeta {
  const { key: _key, ...meta } = record;
  return {
    ...meta,
    lastAccessedAt,
  };
}

function createStreamSource(
  songId: string,
  urlResolver: CacheAudioUrlResolver,
): AudioSourceDescriptor {
  return {
    kind: "stream",
    songId,
    url: urlResolver.buildAudioUrl(songId, "stream"),
  };
}

function syntheticAudioMeta(
  songId: string,
  sizeBytes: number,
  cachedAt: number,
  lastAccessedAt = cachedAt,
): CachedItemMeta {
  return {
    id: songId,
    type: "audio",
    source: "explicit",
    sizeBytes,
    cachedAt,
    lastAccessedAt,
  };
}

export function getAudioSourceUrl(source: AudioSourceDescriptor): string {
  return source.kind === "native-file" ? source.uri : source.url;
}

export function isCachedAudioSource(source: AudioSourceDescriptor): boolean {
  return source.kind === "blob" || source.kind === "native-file";
}

export function revokeAudioSource(source: AudioSourceDescriptor | null): void {
  if (source?.kind === "blob") {
    source.revoke();
  }
}

export class CacheAudioSourceResolver implements AudioSourceResolver {
  private readonly storage: CacheStorageAdapter;
  private readonly index: CacheIndexAdapter;
  private readonly metadata: CacheMetadataPersistence;
  private readonly urlResolver: CacheAudioUrlResolver;
  private readonly nativeFileResolver?: NativeFileResolver;
  private readonly blobUrls: BlobUrlAdapter;
  private readonly preferStreamOverBlob: boolean;
  private readonly now: () => number;

  constructor(options: CacheAudioSourceResolverOptions) {
    this.storage = options.storage;
    this.index = options.index;
    this.metadata = options.metadata;
    this.urlResolver = options.urlResolver;
    this.nativeFileResolver = options.nativeFileResolver;
    this.blobUrls = options.blobUrls;
    this.preferStreamOverBlob = options.preferStreamOverBlob ?? false;
    this.now = options.now ?? Date.now;
  }

  async resolveSongSource(songId: string): Promise<AudioSourceDescriptor> {
    const nativeFile = await this.nativeFileResolver?.resolveAudioFile(songId);
    if (nativeFile) {
      await this.ensureNativeFileIndexed(nativeFile);
      return {
        kind: "native-file",
        songId,
        uri: nativeFile.uri,
      };
    }

    const nativeCache = nativeCacheAdapter(this.nativeFileResolver);
    if (nativeCache) {
      const blob = await this.getCachedBlobAndEnsureIndexed(songId);
      if (blob) {
        const migratedFile = await nativeCache.storeAudioFile(
          songId,
          blob,
          blob.type || "audio/mpeg",
        );
        await this.ensureNativeFileIndexed(migratedFile);
        return {
          kind: "native-file",
          songId,
          uri: migratedFile.uri,
        };
      }
    }

    if (this.preferStreamOverBlob) {
      return createStreamSource(songId, this.urlResolver);
    }

    const blobSource = await this.resolveCachedBlobSource(songId);
    return blobSource ?? createStreamSource(songId, this.urlResolver);
  }

  resolveRadioSource(url: string, radioId?: string): AudioSourceDescriptor {
    return { kind: "radio", url, radioId };
  }

  async resolveCachedBlobSource(
    songId: string,
  ): Promise<BlobAudioSource | null> {
    const blob = await this.getCachedBlobAndEnsureIndexed(songId);
    if (!blob) return null;

    const url = this.blobUrls.createObjectURL(blob);
    return {
      kind: "blob",
      songId,
      url,
      revoke: () => this.blobUrls.revokeObjectURL(url),
    };
  }

  private async getCachedBlobAndEnsureIndexed(
    songId: string,
  ): Promise<Blob | null> {
    const key = audioKey(songId);
    const { loaded } = this.index.getSnapshot();

    if (loaded && !this.index.hasItem(key)) {
      return null;
    }

    const blob = await this.storage.get(key);
    if (!blob) {
      if (this.index.hasItem(key) && !this.nativeFileResolver) {
        this.index.removeItem(key);
      }
      return null;
    }

    if (!this.index.hasItem(key)) {
      const existing = await this.metadata.get(key);
      if (existing) {
        this.index.addItem(key, cacheMetaFromRecord(existing, this.now()));
      } else {
        const syntheticMeta: CachedItemMeta = {
          id: songId,
          type: "audio",
          source: "explicit",
          sizeBytes: blob.size,
          cachedAt: this.now(),
          lastAccessedAt: this.now(),
        };
        this.index.addItem(key, syntheticMeta);
        await this.metadata.put(key, { key, ...syntheticMeta });
      }
    } else {
      this.index.touchItem(key);
    }

    return blob;
  }

  private async ensureNativeFileIndexed(
    file: NativeCachedAudioFile,
  ): Promise<void> {
    const key = audioKey(file.songId);

    if (!this.index.hasItem(key)) {
      const existing = await this.metadata.get(key);
      if (existing) {
        this.index.addItem(key, cacheMetaFromRecord(existing, this.now()));
        return;
      }

      const now = this.now();
      const cachedAt = file.lastModifiedAt ?? now;
      const meta = syntheticAudioMeta(
        file.songId,
        file.sizeBytes ?? 0,
        cachedAt,
        now,
      );
      this.index.addItem(key, meta);
      await this.metadata.put(key, { key, ...meta });
      return;
    }

    this.index.touchItem(key);
  }
}

function nativeCacheAdapter(resolver: NativeFileResolver | undefined):
  | (NativeFileResolver & {
      storeAudioFile(
        songId: string,
        data: Blob,
        contentType: string,
      ): Promise<NativeCachedAudioFile>;
    })
  | null {
  if (!resolver || !("storeAudioFile" in resolver)) return null;
  return resolver as NativeFileResolver & {
    storeAudioFile(
      songId: string,
      data: Blob,
      contentType: string,
    ): Promise<NativeCachedAudioFile>;
  };
}
