import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { useCacheStore } from "@/store/cache.store";

export function SyncIndicator() {
  const { t } = useTranslation();
  const isSyncing = useCacheStore(
    (state) => state.status.syncState.isSyncing,
  );
  const phase = useCacheStore(
    (state) => state.status.syncState.phase,
  );

  if (!isSyncing) return null;

  const phaseText = t(
    `settings.storage.sync.phases.${phase}`,
  );

  return (
    <SimpleTooltip text={phaseText} side="bottom">
      <div className="flex items-center justify-center h-8 w-8">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    </SimpleTooltip>
  );
}
