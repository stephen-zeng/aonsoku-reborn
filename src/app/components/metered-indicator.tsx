import { SignalLow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/app/components/ui/badge";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { useIsMetered, useIsOnline } from "@/store/cache.store";

/**
 * Subtle indicator shown in the header when we're on a metered /
 * slow connection. Hidden entirely when offline (the existing
 * OfflineIndicator takes over) or on a clean connection.
 */
export function MeteredIndicator() {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const isMetered = useIsMetered();

  if (!isOnline || !isMetered) return null;

  return (
    <SimpleTooltip text={t("offline.meteredTooltip")} side="bottom">
      <Badge variant="outline" className="electron-no-drag gap-1 select-none">
        <SignalLow className="h-3 w-3" />
        <span>{t("offline.metered")}</span>
      </Badge>
    </SimpleTooltip>
  );
}
