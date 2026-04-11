import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { getNetworkStatus } from "@/app/hooks/use-network-status";
import { useIsOfflineMode, useIsOnline } from "@/store/cache.store";
import { metadataSyncService } from "@/service/cache";

export function offlineAwareQueryFn<T>(
  onlineFn: () => Promise<T>,
  offlineFn: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    if (getNetworkStatus().isOfflineMode) {
      return offlineFn();
    }
    return onlineFn();
  };
}

export const offlineData = {
  genres: () => metadataSyncService.getGenres(),
  artists: () => metadataSyncService.getArtists(),
  albums: () => metadataSyncService.getAlbums(),
  songs: () => metadataSyncService.getSongs(),
  playlists: () => metadataSyncService.getPlaylists(),
} as const;

type QueryOptionKeys<T> = Pick<
  UseQueryOptions<T>,
  | "staleTime"
  | "gcTime"
  | "refetchInterval"
  | "refetchOnWindowFocus"
  | "refetchOnMount"
  | "refetchOnReconnect"
  | "initialData"
  | "placeholderData"
>;

interface UseOfflineQueryOptions<T> extends QueryOptionKeys<T> {
  enabled?: boolean;
  offlineFn?: () => Promise<T>;
}

export function useOfflineQuery<T>(
  queryKey: unknown[],
  onlineFn: () => Promise<T>,
  options?: UseOfflineQueryOptions<T>,
) {
  const isOnline = useIsOnline();
  const isOfflineMode = useIsOfflineMode();
  const hasOfflineFallback = !!options?.offlineFn;

  const enabled =
    options?.enabled !== undefined
      ? options.enabled && (isOnline || (isOfflineMode && hasOfflineFallback))
      : isOnline || (isOfflineMode && hasOfflineFallback);

  const {
    offlineFn: _offlineFn,
    enabled: _enabled,
    ...queryOptions
  } = options ?? {};

  return useQuery<T>({
    queryKey,
    queryFn: offlineAwareQueryFn(onlineFn, options?.offlineFn ?? onlineFn),
    enabled,
    ...queryOptions,
  });
}
