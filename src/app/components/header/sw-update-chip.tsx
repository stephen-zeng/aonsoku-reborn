import { Loader2, RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/app/components/ui/badge";
import { useSwUpdate } from "@/app/hooks/use-sw-update";

export function SwUpdateChip() {
  const { t } = useTranslation();
  const { status, applyUpdate } = useSwUpdate();

  if (status === "installing") {
    return (
      <Badge
        variant="beta"
        className="electron-no-drag gap-1 select-none"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>{t("update.sw.updating")}</span>
      </Badge>
    );
  }

  if (status === "waiting") {
    return (
      <Badge
        variant="beta"
        className="electron-no-drag gap-1 cursor-pointer select-none hover:bg-primary/30 active:bg-primary/40"
        role="button"
        tabIndex={0}
        onClick={applyUpdate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            applyUpdate();
          }
        }}
      >
        <RefreshCwIcon className="h-3 w-3" />
        <span>{t("update.sw.refresh")}</span>
      </Badge>
    );
  }

  return null;
}
