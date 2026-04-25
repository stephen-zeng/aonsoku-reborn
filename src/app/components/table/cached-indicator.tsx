import {
  AlertCircle,
  CircleArrowDown,
  Cloud,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { audioKey } from "@/service/cache";
import {
  useCacheIndexStore,
  useDownloadProgress,
} from "@/store/cache-index.store";
import type { CacheMetaSource } from "@/types/cache";

type IndicatorVariant = "compact" | "full";

interface CachedIndicatorProps {
  songId: string;
  /**
   * `"compact"` (default) — only renders when the song is locally
   *   available. Use inside dense rows where an empty cell is
   *   preferable to a subtle cloud badge.
   * `"full"` — renders the three-state layering described in the
   *   offline architecture doc: ✓ for local, ☁️ for
   *   needs-network, nothing for not-in-library. Use in headers,
   *   lyric panels, player-bottom rows.
   */
  variant?: IndicatorVariant;
  className?: string;
}

function useAudioCacheMeta(songId: string) {
  return useCacheIndexStore((state) => state.items[audioKey(songId)]);
}

export function CachedIndicator({
  songId,
  variant = "compact",
  className,
}: CachedIndicatorProps) {
  const { t } = useTranslation();
  const isCached = useCacheIndexStore((state) => audioKey(songId) in state.items);
  const meta = useAudioCacheMeta(songId);
  const progress = useDownloadProgress(songId);
  const source = meta?.source as CacheMetaSource | undefined;

  if (progress !== undefined) {
    return (
      <DownloadingIndicator
        progress={progress}
        className={className}
      />
    );
  }

  if (!isCached) {
    if (variant === "compact") return null;
    return (
      <Cloud
        className={cn(
          "w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-60",
          className,
        )}
        aria-label={t("offline.badge.cloud")}
      />
    );
  }

  // Orphan: cached locally but the server no longer lists this song.
  // Playable, but the UI should tell the user the library moved on.
  if (meta?.removedFromServer) {
    return (
      <AlertCircle
        className={cn("w-3.5 h-3.5 text-amber-500/80 flex-shrink-0", className)}
        aria-label={t("offline.badge.orphan")}
      />
    );
  }

  // Explicit downloads get the filled arrow (the same icon Aonsoku has
  // been using since the feature landed). Smart-cached items use a
  // slightly softer accent so the user can tell at a glance that the
  // system, not them, decided to keep the song offline.
  if (source === "smart") {
    return (
      <Sparkles
        className={cn(
          "w-3.5 h-3.5 text-emerald-500/70 flex-shrink-0",
          className,
        )}
        aria-label={t("offline.badge.smart")}
      />
    );
  }

  return (
    <CircleArrowDown
      className={cn(
        "w-3.5 h-3.5 text-muted-foreground flex-shrink-0",
        className,
      )}
      aria-label={t("offline.badge.downloaded")}
    />
  );
}

interface DownloadingIndicatorProps {
  /** 0–100 progress percentage; omit for an indeterminate spinner. */
  progress?: number;
  className?: string;
}

const RADIUS = 7;
const STROKE = 2.5;
const NORMALIZED_RADIUS = RADIUS - STROKE / 2;
const CIRCUMFERENCE = NORMALIZED_RADIUS * 2 * Math.PI;

/**
 * Shown while a `cacheSong` operation is in flight.
 */
export function DownloadingIndicator({
  progress,
  className,
}: DownloadingIndicatorProps) {
  const { t } = useTranslation();
  const hasProgress = typeof progress === "number" && progress >= 0;

  if (!hasProgress) {
    return (
      <Loader2
        className={cn(
          "w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0",
          className,
        )}
        aria-label={t("offline.badge.downloading")}
      />
    );
  }

  const clamped = Math.max(0, Math.min(100, progress ?? 0));
  const strokeDashoffset =
    CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;

  return (
    <svg
      width={RADIUS * 2}
      height={RADIUS * 2}
      viewBox={`0 0 ${RADIUS * 2} ${RADIUS * 2}`}
      className={cn("flex-shrink-0", className)}
      aria-label={t("offline.badge.downloading")}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <circle
        stroke="currentColor"
        fill="transparent"
        strokeWidth={STROKE}
        className="text-muted-foreground/20"
        r={NORMALIZED_RADIUS}
        cx={RADIUS}
        cy={RADIUS}
      />
      <circle
        stroke="currentColor"
        fill="transparent"
        strokeWidth={STROKE}
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        style={{ strokeDashoffset }}
        strokeLinecap="round"
        className="text-muted-foreground transition-all duration-300 ease-in-out"
        r={NORMALIZED_RADIUS}
        cx={RADIUS}
        cy={RADIUS}
        transform={`rotate(-90 ${RADIUS} ${RADIUS})`}
      />
    </svg>
  );
}
