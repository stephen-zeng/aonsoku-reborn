import { useTranslation } from "react-i18next";

interface OfflineLibraryEmptyStateProps {
  title?: string;
}

export function OfflineLibraryEmptyState({
  title,
}: OfflineLibraryEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="text-center max-w-[500px]">
      <h3 className="text-2xl font-semibold tracking-tight">
        {title ?? t("offline.mode")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {t("settings.storage.sync.description")}
      </p>
      <p className="text-sm text-muted-foreground">
        {t("settings.storage.sync.lastSynced")}:{" "}
        {t("settings.storage.sync.never")}
      </p>
    </div>
  );
}
