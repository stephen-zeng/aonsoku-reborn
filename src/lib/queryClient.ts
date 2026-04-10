import { QueryClient } from "@tanstack/react-query";
import { isReachabilityError } from "@/api/errors";
import { getNetworkStatus } from "@/app/hooks/use-network-status";

const FIVE_MINUTES = 5 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: FIVE_MINUTES,
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
