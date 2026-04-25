import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/lib/utils";
import { syncService } from "@/service/cache/sync-worker-adapter";
import {
  useCacheStore,
  useIsOnline,
  useLastSyncedAt,
  useLibraryCaching,
} from "@/store/cache.store";
import type { SyncPhase, SyncState, SyncTier } from "@/types/cache";
import dayjs from "@/utils/dateTime";

const TIER_ORDER: Record<SyncTier, number> = { t1: 0, t2: 1, t3: 2 };

const T1_PHASE_WEIGHTS: Record<string, number> = {
  genres: 0.2,
  playlists: 0.5,
  favorites: 0.3,
};
const T2_PHASE_WEIGHTS: Record<string, number> = {
  artists: 0.3,
  albums: 0.7,
};
const T3_PHASE_WEIGHTS: Record<string, number> = {
  songs: 1,
};

const TIER_PHASE_WEIGHTS: Record<SyncTier, Record<string, number>> = {
  t1: T1_PHASE_WEIGHTS,
  t2: T2_PHASE_WEIGHTS,
  t3: T3_PHASE_WEIGHTS,
};

type TierStatus = "pending" | "running" | "done";

function tierProgress(tier: SyncTier, state: SyncState): number {
  const status = tierStatus(tier, state);
  if (status === "done") return 100;
  if (status === "pending") return 0;

  const weights = TIER_PHASE_WEIGHTS[tier];
  const phaseOrder = Object.keys(weights);
  const currentIdx = phaseOrder.indexOf(state.phase);
  if (currentIdx < 0) return 0;

  let completed = 0;
  for (let i = 0; i < currentIdx; i++) {
    completed += weights[phaseOrder[i]];
  }
  const currentWeight = weights[phaseOrder[currentIdx]];
  completed += (currentWeight * state.progress) / 100;

  return Math.min(100, Math.round(completed * 100));
}

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
  progress,
}: {
  tier: SyncTier;
  status: TierStatus;
  phase: SyncPhase;
  progress: number;
}) {
  const { t } = useTranslation();
  const phaseLabel = t(`settings.storage.sync.phases.${phase}`);

  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded-full shrink-0",
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
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {t(`settings.storage.sync.tier.${tier}.description`)}
          </p>
          {status === "running" && (
            <p className="text-[10px] text-blue-500 truncate leading-tight">
              {phaseLabel}
            </p>
          )}
        </div>
        {status !== "pending" && (
          <span
            className={cn(
              "text-xs tabular-nums shrink-0",
              status === "done" && "text-emerald-500",
              status === "running" && "text-muted-foreground",
            )}
          >
            {progress}%
          </span>
        )}
      </div>
      <div className="ml-7 mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            status === "done" && "bg-emerald-500",
            status === "running" && "bg-blue-500",
          )}
          style={{
            width: status === "pending" ? "0%" : `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}

function getSyncTitle(t: (key: string) => string, phase: SyncPhase): string {
  switch (phase) {
    case "idle":
      return t("settings.storage.sync.group");
    case "done":
      return t("settings.storage.sync.phases.done");
    case "error":
      return t("settings.storage.sync.phases.error");
    case "cancelled":
      return t("settings.storage.sync.phases.cancelled");
    default:
      return t("settings.storage.sync.phases.idle");
  }
}

function formatLastSynced(
  lastSyncedAt: number | null,
  t: (key: string) => string,
): string {
  if (!lastSyncedAt) return t("settings.storage.sync.never");
  const fromNow = dayjs(lastSyncedAt).fromNow();
  if (fromNow === "a few seconds ago" || fromNow === "几秒前") {
    return t("settings.storage.sync.justNow");
  }
  return fromNow;
}

export function SyncProgressBar() {
  const { t } = useTranslation();
  const libraryCaching = useLibraryCaching();
  const isOnline = useIsOnline();
  const lastSyncedAt = useLastSyncedAt();
  const syncState = useCacheStore((s) => s.status.syncState);

  if (!isOnline) return null;

  const showError = syncState.phase === "error";
  const showCompleted = syncState.phase === "done";

  const handleRetry = () => {
    const { syncCoverArt } = useCacheStore.getState().settings;
    syncService.syncAll({
      includeCoverArt: syncCoverArt,
      includeFullSongs: true,
    });
  };

  const isSyncing = syncState.isSyncing;
  const title = isSyncing
    ? t("settings.storage.sync.phases.idle")
    : getSyncTitle(t, syncState.phase);
  const timeText = formatLastSynced(lastSyncedAt, t);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 electron-no-drag"
        >
          {showError ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          ) : showCompleted ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : syncState.isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold">{title}</p>
            <p className="text-[10px] text-muted-foreground">{timeText}</p>
          </div>

          {/* Error Banner */}
          {showError && (
            <div className="mb-3 px-2.5 py-1.5 rounded-md bg-amber-500/10 text-amber-600 text-[10px] flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{t("settings.storage.sync.phases.error")}</span>
            </div>
          )}

          <TierRow
            tier="t1"
            status={tierStatus("t1", syncState)}
            phase={syncState.phase}
            progress={tierProgress("t1", syncState)}
          />
          <TierRow
            tier="t2"
            status={tierStatus("t2", syncState)}
            phase={syncState.phase}
            progress={tierProgress("t2", syncState)}
          />
          {libraryCaching && (
            <TierRow
              tier="t3"
              status={tierStatus("t3", syncState)}
              phase={syncState.phase}
              progress={tierProgress("t3", syncState)}
            />
          )}

          {/* Always-visible sync button */}
          <div className="pt-3 mt-2 border-t">
            <Button
              size="sm"
              variant={showError ? "default" : "outline"}
              className="w-full h-8 text-xs"
              onClick={handleRetry}
            >
              <RefreshCw className="w-3 h-3 mr-1.5" />
              {t("settings.storage.sync.syncNow")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
