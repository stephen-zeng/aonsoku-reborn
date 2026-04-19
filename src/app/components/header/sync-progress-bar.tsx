import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import { metadataSyncService } from "@/service/cache";
import { useCacheStore } from "@/store/cache.store";
import type { SyncPhase, SyncState, SyncTier } from "@/types/cache";

const TIER_ORDER: Record<SyncTier, number> = { t1: 0, t2: 1, t3: 2 };
const AUTO_HIDE_MS = 2000;

type TierStatus = "pending" | "running" | "done";

function tierStatus(tier: SyncTier, state: SyncState): TierStatus {
  if (state.phase === "done") return "done";
  if (state.phase === "error") {
    if (!state.tier) return "pending";
    const errored = TIER_ORDER[state.tier];
    const t = TIER_ORDER[tier];
    if (t < errored) return "done";
    if (t === errored) return "pending"; // interrupted mid-run
    return "pending";
  }
  if (!state.tier) return "pending";
  const current = TIER_ORDER[state.tier];
  const t = TIER_ORDER[tier];
  if (t < current) return "done";
  if (t === current) return "running";
  return "pending";
}

function TierRow({
  tier,
  status,
  phase,
}: {
  tier: SyncTier;
  status: TierStatus;
  phase: SyncPhase;
}) {
  const { t } = useTranslation();
  const phaseLabel = t(`settings.storage.sync.phases.${phase}`);

  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className={cn(
          "w-5 h-5 flex items-center justify-center rounded-full",
          status === "done" && "bg-emerald-500/10 text-emerald-500",
          status === "running" && "bg-blue-500/10 text-blue-500",
          status === "pending" && "text-muted-foreground",
        )}
      >
        {status === "done" && <Check className="w-3 h-3" />}
        {status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
        {status === "pending" && (
          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-xs font-medium",
            status === "pending" && "text-muted-foreground",
          )}
        >
          {t(`settings.storage.sync.tier.${tier}.label`)}
        </p>
        {status === "running" && (
          <p className="text-xs text-muted-foreground truncate">{phaseLabel}</p>
        )}
      </div>
    </div>
  );
}

export function SyncProgressBar() {
  const { t } = useTranslation();
  const syncState = useCacheStore((s) => s.status.syncState);
  const syncLibrary = useCacheStore((s) => s.settings.syncLibrary);
  const syncCoverArt = useCacheStore((s) => s.settings.syncCoverArt);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (syncState.phase === "done" && !syncState.isSyncing) {
      setShowCompleted(true);
      const timer = setTimeout(() => setShowCompleted(false), AUTO_HIDE_MS);
      return () => clearTimeout(timer);
    }
    setShowCompleted(false);
  }, [syncState.phase, syncState.isSyncing]);

  const showError = syncState.phase === "error";
  if (!syncState.isSyncing && !showCompleted && !showError) return null;

  const handleRetry = () => {
    metadataSyncService.syncAll({
      includeCoverArt: syncCoverArt,
      includeFullSongs: syncLibrary,
    });
  };

  const barLabel = showError
    ? t("settings.storage.sync.phases.error")
    : showCompleted
      ? t("settings.storage.sync.phases.done")
      : `${syncState.progress}% · ${t(`settings.storage.sync.phases.${syncState.phase}`)}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 electron-no-drag text-xs"
        >
          {showError ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          ) : showCompleted ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          )}
          <span className="hidden sm:inline max-w-[200px] truncate">
            {barLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold mb-2">
            {t("settings.storage.sync.group")}
          </p>
          <TierRow
            tier="t1"
            status={tierStatus("t1", syncState)}
            phase={syncState.phase}
          />
          <TierRow
            tier="t2"
            status={tierStatus("t2", syncState)}
            phase={syncState.phase}
          />
          {syncLibrary && (
            <TierRow
              tier="t3"
              status={tierStatus("t3", syncState)}
              phase={syncState.phase}
            />
          )}
          {showError && (
            <div className="pt-2 mt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs"
                onClick={handleRetry}
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {t("settings.storage.sync.syncNow")}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
