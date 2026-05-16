import { audioUrlResolver } from "../audio-url-resolver";
import { cacheIndexAdapter } from "../cache-index-adapter";
import { cacheStorage } from "../cache-storage";
import { cacheMetadataPersistence } from "../persist-meta";
import {
  CacheAudioSourceResolver,
  getAudioSourceUrl,
  isCachedAudioSource,
  revokeAudioSource,
  type BlobAudioSource,
  type BlobUrlAdapter,
  type CacheAudioSourceResolverOptions,
} from "./resolver";

const browserBlobUrls: BlobUrlAdapter = {
  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  },

  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  },
};

export const audioSourceResolver = new CacheAudioSourceResolver({
  storage: cacheStorage,
  index: cacheIndexAdapter,
  metadata: cacheMetadataPersistence,
  urlResolver: audioUrlResolver,
  blobUrls: browserBlobUrls,
});

export function resolveCachedAudioSource(
  songId: string,
): Promise<BlobAudioSource | null> {
  return audioSourceResolver.resolveCachedBlobSource(songId);
}

export {
  CacheAudioSourceResolver,
  getAudioSourceUrl,
  isCachedAudioSource,
  revokeAudioSource,
};

export type {
  BlobAudioSource,
  BlobUrlAdapter,
  CacheAudioSourceResolverOptions,
};
