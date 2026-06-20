import { hasTauriBridge } from "@/utils/desktop";
import { audioUrlResolver } from "../audio-url-resolver";
import { cacheIndexAdapter } from "../cache-index-adapter";
import { cacheStorage } from "../cache-storage";
import { getNativeCacheAdapter } from "../native-cache-adapter";
import { cacheMetadataPersistence } from "../persist-meta";
import {
  type BlobAudioSource,
  type BlobUrlAdapter,
  CacheAudioSourceResolver,
  type CacheAudioSourceResolverOptions,
  getAudioSourceUrl,
  isCachedAudioSource,
  revokeAudioSource,
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
  nativeFileResolver: getNativeCacheAdapter(),
  blobUrls: browserBlobUrls,
  preferStreamOverBlob: hasTauriBridge(),
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
