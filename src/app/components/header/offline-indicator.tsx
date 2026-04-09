import { LoaderIcon, WifiOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/app/components/ui/badge";
import { useOfflineState } from "@/store/offline.store";

export function OfflineIndicator() {
  const { t } = useTranslation();
  const { isOfflineMode, isReconnecting } = useOfflineState();

  if (!isOfflineMode) return null;

  return (
    <Badge
      variant="outline"
      className="gap-1 border-yellow-500/50 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 whitespace-nowrap"
    >
      {isReconnecting ? (
        <>
          <LoaderIcon className="w-3 h-3 animate-spin" />
          {t("offline.reconnecting")}
        </>
      ) : (
        <>
          <WifiOffIcon className="w-3 h-3" />
          {t("offline.mode")}
        </>
      )}
    </Badge>
  );
}
