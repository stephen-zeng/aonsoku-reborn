import { audioCache } from "./audio-cache";
import { coverArtCache } from "./cover-art-cache";
import { metadataCache } from "./metadata-cache";
import { clearQueryCache } from "./query-persister";
import { queryClient } from "@/lib/queryClient";
import { useOfflineStore } from "@/store/offline.store";

export { formatBytes } from "@/utils/formatBytes";

export async function getCoverArtCacheSize(): Promise<number> {
  return coverArtCache.getTotalSize();
}

export async function getAudioCacheSize(): Promise<number> {
  return audioCache.getTotalSize();
}

export async function getCoverArtCacheCount(): Promise<number> {
  return coverArtCache.getEntryCount();
}

export async function getAudioCacheCount(): Promise<number> {
  return audioCache.getEntryCount();
}

export async function clearCoverArtCache(): Promise<void> {
  await coverArtCache.clear();
}

export async function clearAudioCache(): Promise<void> {
  await audioCache.clear();
  await useOfflineStore.getState().actions.refreshCachedSongIds();
  await queryClient.invalidateQueries();
}

export async function clearMetadataCache(): Promise<void> {
  await clearQueryCache();
  await queryClient.invalidateQueries();
}

export async function clearMetadataSyncCache(): Promise<void> {
  await metadataCache.clear();
  await queryClient.invalidateQueries();
}

export async function clearAllCaches(): Promise<void> {
  await Promise.all([
    coverArtCache.clear(),
    audioCache.clear(),
    clearQueryCache(),
    metadataCache.clear(),
  ]);
  await useOfflineStore.getState().actions.refreshCachedSongIds();
  await queryClient.invalidateQueries();
}
