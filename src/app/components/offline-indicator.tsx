import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/app/components/ui/badge";
import { SimpleTooltip } from "@/app/components/ui/simple-tooltip";
import { useIsOnline } from "@/store/cache.store";

export function OfflineIndicator() {
  const { t } = useTranslation();
  const isOnline = useIsOnline();

  if (isOnline) return null;

  return (
    <SimpleTooltip text={t("offline.disconnected")} side="bottom">
      <Badge
        variant="destructive"
        className="electron-no-drag gap-1 select-none"
      >
        <WifiOff className="h-3 w-3" />
        <span>{t("offline.mode")}</span>
      </Badge>
    </SimpleTooltip>
  );
}
