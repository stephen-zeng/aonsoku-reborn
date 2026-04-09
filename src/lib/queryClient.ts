import { onlineManager, QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createIDBPersister } from "@/lib/cache/query-persister";
import { useOfflineStore } from "@/store/offline.store";

const FIVE_MINUTES = 5 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: FIVE_MINUTES,
      gcTime: TWENTY_FOUR_HOURS,
    },
  },
});

const persister = createIDBPersister();

persistQueryClient({
  queryClient,
  persister,
  maxAge: TWENTY_FOUR_HOURS,
});

// Sync offline state with React Query's online manager
useOfflineStore.subscribe(
  (ctx) => ctx.state.isOfflineMode,
  (isOffline) => {
    onlineManager.setOnline(!isOffline);
  },
);
