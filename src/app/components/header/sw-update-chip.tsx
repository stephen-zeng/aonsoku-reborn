import type { LucideIcon } from "lucide-react";
import { AlertTriangleIcon, Loader2, RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/app/components/ui/badge";
import { useSwUpdate } from "@/app/hooks/use-sw-update";

function ActionBadge({
  variant,
  className,
  onClick,
  icon: Icon,
  label,
}: {
  variant: "beta" | "destructive";
  className?: string;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Badge
      variant={variant}
      className={`electron-no-drag gap-1 cursor-default h-5 select-none ${className ?? ""}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </Badge>
  );
}

export function SwUpdateChip() {
  const { t } = useTranslation();
  const { status, applyUpdate, retryUpdate } = useSwUpdate();

  if (status === "installing") {
    return (
      <Badge variant="beta" className="electron-no-drag gap-1 h-5 select-none cursor-default">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{t("update.sw.updating")}</span>
      </Badge>
    );
  }

  if (status === "waiting") {
    return (
      <ActionBadge
        variant="beta"
        className="hover-supported:bg-primary/30 active:bg-primary/40"
        onClick={applyUpdate}
        icon={RefreshCwIcon}
        label={t("update.sw.refresh")}
      />
    );
  }

  if (status === "error") {
    return (
      <ActionBadge
        variant="destructive"
        onClick={retryUpdate}
        icon={AlertTriangleIcon}
        label={t("update.sw.error")}
      />
    );
  }

  return null;
}
