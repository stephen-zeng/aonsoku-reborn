import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useIsOnline } from "@/store/cache.store";
import { libraryDb } from "@/store/library-db";

/**
 * Readers that return the current IDB contents for each library table.
 * These always read Dexie regardless of network state — the sync service
 * is responsible for keeping Dexie fresh.
 */
export const offlineData = {
  genres: () => libraryDb.genres.toArray(),
  artists: () => libraryDb.artists.toArray(),
  albums: () => libraryDb.albums.toArray(),
  songs: () => libraryDb.songs.toArray(),
  playlists: () => libraryDb.playlists.toArray(),
} as const;

function isEmptyResult(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Build a queryFn that reads IDB first and falls back to the network
 * only when IDB has nothing to offer (fresh install, never synced,
 * specific entity not yet in cache). Once IDB is populated, the network
 * path is never taken — the SyncService repopulates IDB in the
 * background and calls `queryClient.invalidateQueries` to refresh the UI.
 */
export function idbFirstQueryFn<T>(
  onlineFn: () => Promise<T>,
  offlineFn?: () => Promise<T>,
): () => Promise<T> {
  if (!offlineFn) return onlineFn;
  return async () => {
    try {
      const cached = await offlineFn();
      if (!isEmptyResult(cached)) return cached;
    } catch (err) {
      console.warn(
        "[offlineQueryClient] IDB read failed, falling back to network:",
        err,
      );
    }
    return onlineFn();
  };
}

// Legacy export name. Behavior is now IDB-first regardless of network
// state (previously branched on `isOfflineMode`). Kept for callers that
// still import the old name — will be removed once all callsites migrate
// to `idbFirstQueryFn` or `useOfflineQuery`.
export const offlineAwareQueryFn = idbFirstQueryFn;

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

/**
 * React Query wrapper that prefers IDB over the network. When
 * `offlineFn` is provided, the IDB read is always attempted first;
 * the network fetch is only used when IDB is empty or the read throws.
 *
 * When `offlineFn` is not provided (pure-network queries like
 * getArtistInfo, getAlbumInfo), the hook disables the query while the
 * user is offline so the UI doesn't flash an error screen on startup.
 */
export function useOfflineQuery<T>(
  queryKey: unknown[],
  onlineFn: () => Promise<T>,
  options?: UseOfflineQueryOptions<T>,
) {
  const isOnline = useIsOnline();
  const { offlineFn, enabled, ...queryOptions } = options ?? {};

  // With an IDB fallback we can always run; otherwise require network.
  const canRun = offlineFn ? true : isOnline;
  const resolvedEnabled = enabled !== undefined ? enabled && canRun : canRun;

  return useQuery<T>({
    queryKey,
    queryFn: idbFirstQueryFn(onlineFn, offlineFn),
    enabled: resolvedEnabled,
    ...queryOptions,
  });
}
