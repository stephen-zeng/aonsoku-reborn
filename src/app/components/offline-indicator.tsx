import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsOfflineMode } from "@/store/cache.store";

/**
 * Shows an "Offline" badge when the app is in offline mode.
 * Mount this at the app root level.
 */
export function OfflineIndicator() {
  const { t } = useTranslation();
  const isOfflineMode = useIsOfflineMode();

  if (!isOfflineMode) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="mt-2 px-3 py-1.5 rounded-full bg-amber-500/90 text-white text-xs font-medium flex items-center gap-1.5 pointer-events-auto shadow-lg">
        <WifiOff className="w-3 h-3" />
        <span>{t("offline", "Offline")}</span>
      </div>
    </div>
  );
}
