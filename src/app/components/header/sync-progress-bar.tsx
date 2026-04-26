import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Image,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DownloadingIndicator } from "@/app/components/table/cached-indicator";
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
  useSyncState,
} from "@/store/cache.store";
import { useActiveDownloadsSummary } from "@/store/cache-index.store";
import { libraryDb } from "@/store/library-db";
import type { SyncPhase, SyncState, SyncTier } from "@/types/cache";
import dateTime from "@/utils/dateTime";
import { formatBytes } from "@/utils/formatBytes";

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

type TierStatus = "pending" | "running" | "done" | "error";

function tierProgress(tier: SyncTier, state: SyncState): number {
  const status = tierStatus(tier, state);
  if (status === "done" || status === "error") return 100;
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

const POST_TIER_PHASES: Set<string> = new Set(["coverArt"]);

function tierStatus(tier: SyncTier, state: SyncState): TierStatus {
  if (state.phase === "done" || state.phase === "cancelled") return "done";
  if (POST_TIER_PHASES.has(state.phase)) return "done";
  if (state.phase === "error") {
    if (!state.tier) return "pending";
    const errored = TIER_ORDER[state.tier];
    const t = TIER_ORDER[tier];
    if (t < errored) return "done";
    if (t === errored) return "error";
    return "pending";
  }
  if (!state.tier) return "pending";
  const current = TIER_ORDER[state.tier];
  const t = TIER_ORDER[tier];
  if (t < current) return "done";
  if (t === current) return "running";
  return "pending";
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
  const diffSeconds = dateTime().diff(dateTime(lastSyncedAt), "second");
  if (diffSeconds < 60) return t("settings.storage.sync.justNow");
  return dateTime(lastSyncedAt).fromNow();
}

const TierRow = memo(function TierRow({
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
            status === "error" && "bg-amber-500/10 text-amber-500",
            status === "pending" && "text-muted-foreground",
          )}
        >
          {status === "done" && <Check className="w-3 h-3" />}
          {status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
          {status === "error" && <AlertTriangle className="w-3 h-3" />}
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
        {status === "running" && (
          <span className="text-xs tabular-nums shrink-0 text-muted-foreground">
            {progress}%
          </span>
        )}
      </div>
      {status === "running" && (
        <div className="ml-7 mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
});

const CoverArtRow = memo(function CoverArtRow({
  status,
  progress,
}: {
  status: TierStatus;
  progress: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-5 h-5 flex items-center justify-center rounded-full shrink-0",
            status === "done" && "bg-emerald-500/10 text-emerald-500",
            status === "running" && "bg-blue-500/10 text-blue-500",
            status === "error" && "bg-amber-500/10 text-amber-500",
            status === "pending" && "text-muted-foreground",
          )}
        >
          {status === "done" && <Check className="w-3 h-3" />}
          {status === "running" && <Image className="w-3 h-3 animate-pulse" />}
          {status === "error" && <AlertTriangle className="w-3 h-3" />}
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
            {t("settings.storage.sync.tier.coverArt.label")}
          </p>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">
            {t("settings.storage.sync.tier.coverArt.description")}
          </p>
          {status === "running" && (
            <p className="text-[10px] text-blue-500 truncate leading-tight">
              {t("settings.storage.sync.phases.coverArt")}
            </p>
          )}
        </div>
        {status === "running" && (
          <span className="text-xs tabular-nums shrink-0 text-muted-foreground">
            {progress}%
          </span>
        )}
      </div>
      {status === "running" && (
        <div className="ml-7 mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
});

const PREVIEW_LIMIT = 3;

const DownloadSection = memo(function DownloadSection() {
  const { t } = useTranslation();
  const { downloads, count, hasDownloads } = useActiveDownloadsSummary();
  const [expanded, setExpanded] = useState(false);
  const [songNames, setSongNames] = useState<Record<string, string>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!hasDownloads) {
      fetchedRef.current.clear();
      return;
    }

    const needed = downloads
      .map((d) => d.songId)
      .filter((id) => !fetchedRef.current.has(id));
    if (needed.length === 0) return;

    let cancelled = false;

    const fetchNames = async () => {
      try {
        const songs = await libraryDb.songs.bulkGet(needed);
        if (cancelled) return;
        const newNames: Record<string, string> = {};
        songs.forEach((song, i) => {
          newNames[needed[i]] = song?.title || needed[i];
        });
        setSongNames((prev) => ({ ...prev, ...newNames }));
        needed.forEach((id) => fetchedRef.current.add(id));
      } catch (err) {
        console.warn("[DownloadSection] failed to fetch song names:", err);
      }
    };

    fetchNames();

    return () => {
      cancelled = true;
    };
  }, [hasDownloads, downloads]);

  if (!hasDownloads) return null;

  const allCompleted = downloads.every((d) => d.isCompleted);
  const visibleDownloads = expanded
    ? downloads
    : downloads.slice(0, PREVIEW_LIMIT);
  const hasMore = downloads.length > PREVIEW_LIMIT;

  return (
    <div className="pt-2 border-t">
      {/* Overview row */}
      <div className="py-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-5 h-5 flex items-center justify-center rounded-full shrink-0",
              allCompleted
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-blue-500/10 text-blue-500",
            )}
          >
            {allCompleted ? (
              <Check className="w-3 h-3" />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">
              {t("settings.storage.sync.downloading", { count })}
            </p>
          </div>
        </div>
      </div>

      {/* Download list — always show first 3 */}
      <div className="ml-7 mt-2 space-y-2 max-h-40 overflow-y-auto">
        {visibleDownloads.map(
          ({
            songId,
            progress,
            isCompleted,
            isIndeterminate,
            bytesReceived,
          }) => (
            <div key={songId} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] truncate">
                  {songNames[songId] || "…"}
                </p>
              </div>
              <span className="text-[10px] tabular-nums shrink-0 text-muted-foreground">
                {isCompleted
                  ? t("settings.storage.sync.completed")
                  : isIndeterminate
                    ? formatBytes(bytesReceived)
                    : `${progress}%`}
              </span>
              {isCompleted ? (
                <Check className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : isIndeterminate ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
              ) : (
                <DownloadingIndicator
                  progress={progress}
                  className="w-3.5 h-3.5"
                />
              )}
            </div>
          ),
        )}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="ml-7 mt-1 h-5 text-[10px] text-muted-foreground hover:text-foreground p-0"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              {t("generic.hideDetails")}
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              {t("settings.storage.sync.showMore", {
                count: downloads.length - PREVIEW_LIMIT,
              })}
            </>
          )}
        </Button>
      )}
    </div>
  );
});

function SyncPopoverContent({
  syncState,
  lastSyncedAt,
}: {
  syncState: SyncState;
  lastSyncedAt: number | null;
}) {
  const { t } = useTranslation();
  const syncCoverArt = useCacheStore((s) => s.settings.syncCoverArt);

  const showError = syncState.phase === "error";
  const isSyncing = syncState.isSyncing;

  const handleSyncNow = useCallback(() => {
    const { settings } = useCacheStore.getState();
    syncService.syncAll({
      includeCoverArt: settings.syncCoverArt,
      includeFullSongs: settings.libraryCaching,
    });
  }, []);

  const title = isSyncing
    ? t("settings.storage.sync.phases.idle")
    : getSyncTitle(t, syncState.phase);
  const timeText = useMemo(
    () => formatLastSynced(lastSyncedAt, t),
    [lastSyncedAt, t],
  );

  const tiers = useMemo(
    () =>
      (["t1", "t2", "t3"] as SyncTier[]).map((tier) => ({
        tier,
        status: tierStatus(tier, syncState),
        progress: tierProgress(tier, syncState),
      })),
    [syncState],
  );

  const coverArtStatus = useMemo<TierStatus>(() => {
    if (syncState.phase === "done" || syncState.phase === "cancelled")
      return "done";
    if (syncState.phase === "coverArt") return "running";
    if (syncState.phase === "error") {
      if (!syncState.tier) return "pending";
      return "pending";
    }
    return "pending";
  }, [syncState.phase, syncState.tier]);

  const coverArtProgress =
    syncState.phase === "coverArt" ? syncState.progress : 0;

  return (
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

      {tiers.map(({ tier, status, progress }) => (
        <TierRow
          key={tier}
          tier={tier}
          status={status}
          phase={syncState.phase}
          progress={progress}
        />
      ))}

      {syncCoverArt && (
        <CoverArtRow status={coverArtStatus} progress={coverArtProgress} />
      )}

      <DownloadSection />

      {/* Always-visible sync button */}
      <div className="pt-3">
        <Button
          size="sm"
          variant={showError ? "default" : "outline"}
          className="w-full h-8 text-xs"
          onClick={handleSyncNow}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1.5" />
          )}
          {t("settings.storage.sync.syncNow")}
        </Button>
      </div>
    </div>
  );
}

export function SyncProgressBar() {
  const { t } = useTranslation();
  const libraryCaching = useLibraryCaching();
  const isOnline = useIsOnline();
  const lastSyncedAt = useLastSyncedAt();
  const syncState = useSyncState();
  const { count: downloadCount, hasDownloads } = useActiveDownloadsSummary();

  if (!isOnline || !libraryCaching) return null;

  const showError = syncState.phase === "error";
  const showCompleted = syncState.phase === "done";
  const isSyncing = syncState.isSyncing;

  const triggerLabel = showError
    ? t("settings.storage.sync.phases.error")
    : isSyncing
      ? t("settings.storage.sync.phases.idle")
      : hasDownloads
        ? t("settings.storage.sync.downloading", { count: downloadCount })
        : showCompleted
          ? t("settings.storage.sync.phases.done")
          : t("settings.storage.sync.syncNow");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 electron-no-drag"
          aria-label={triggerLabel}
        >
          {showError ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          ) : isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : hasDownloads ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : showCompleted ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <SyncPopoverContent syncState={syncState} lastSyncedAt={lastSyncedAt} />
      </PopoverContent>
    </Popover>
  );
}
