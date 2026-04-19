import { QueryClient } from "@tanstack/react-query";
import { isReachabilityError } from "@/api/errors";
import { getNetworkStatus } from "@/app/hooks/use-network-status";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // IDB is the source of truth. Queries stay fresh until the sync
      // service writes new data to IDB and calls invalidateQueries.
      // Per-query `staleTime` overrides still apply (e.g., favorites
      // count keeps a 5-minute ceiling so network fallback can refresh).
      staleTime: Infinity,
      gcTime: TWENTY_FOUR_HOURS,
      retry: (failureCount, error) => {
        if (!navigator.onLine || getNetworkStatus().isOfflineMode) {
          return false;
        }

        if (isReachabilityError(error)) {
          return false;
        }

        return failureCount < 3;
      },
    },
  },
});
