import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Content,
  ContentItem,
  ContentItemForm,
  ContentItemTitle,
  ContentSeparator,
  Header,
  HeaderDescription,
  HeaderTitle,
  Root,
} from "@/app/components/settings/section";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import { Switch } from "@/app/components/ui/switch";
import { metadataCache } from "@/lib/cache/metadata-cache";
import dateTime from "@/utils/dateTime";
import {
  useSyncActions,
  useSyncSettings,
  useSyncState,
} from "@/store/sync.store";

function formatLastSynced(ts: number | null, neverLabel: string): string {
  if (ts === null) return neverLabel;
  return dateTime(ts).format("LLL");
}

export function SyncSection() {
  const { t } = useTranslation();
  const { syncOnLaunchEnabled, syncCoverArt } = useSyncSettings();
  const {
    status,
    phase,
    current,
    total,
    phaseIndex,
    totalPhases,
    lastSyncedAt,
    error,
  } = useSyncState();
  const { setSyncOnLaunchEnabled, setSyncCoverArt, startSync, cancelSync } =
    useSyncActions();

  const [entryCount, setEntryCount] = useState(0);

  const refreshCount = useCallback(async () => {
    const count = await metadataCache.getTotalEntryCount();
    setEntryCount(count);
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Re-fetch entry count after sync finishes
  useEffect(() => {
    if (status === "done" || status === "cancelled") {
      refreshCount();
    }
  }, [status, refreshCount]);

  const isRunning = status === "running";

  const progressPercent = isRunning
    ? totalPhases > 0
      ? ((phaseIndex - 1 + (total > 0 ? current / total : 0)) / totalPhases) *
        100
      : 0
    : status === "done"
      ? 100
      : 0;

  async function handleClearSyncData() {
    await metadataCache.clear();
    refreshCount();
  }

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.storage.sync.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.sync.description")}
        </HeaderDescription>
      </Header>
      <Content>
        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.sync.enabled")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={syncOnLaunchEnabled}
              onCheckedChange={setSyncOnLaunchEnabled}
              disabled={isRunning}
            />
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle info={t("settings.storage.sync.coverArtInfo")}>
            {t("settings.storage.sync.coverArt")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={syncCoverArt}
              onCheckedChange={setSyncCoverArt}
              disabled={isRunning}
            />
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.sync.lastSynced")}
          </ContentItemTitle>
          <ContentItemForm>
            <span className="text-sm text-muted-foreground">
              {formatLastSynced(lastSyncedAt, t("settings.storage.sync.never"))}
            </span>
          </ContentItemForm>
        </ContentItem>

        {isRunning && (
          <div className="space-y-1 py-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t(`settings.storage.sync.phases.${phase}`)}</span>
              <span>
                {current.toLocaleString()}
                {total > 0 ? ` / ${total.toLocaleString()}` : ""}
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>
        )}

        {status === "error" && error && (
          <p className="text-xs text-destructive py-1">{error}</p>
        )}

        <ContentItem>
          <span className="flex-1 text-xs text-muted-foreground">
            {t("settings.storage.sync.entries", {
              count: entryCount,
            })}
          </span>
          <ContentItemForm>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="outline" size="sm" onClick={cancelSync}>
                  {t("settings.storage.sync.cancel")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={startSync}>
                  {t("settings.storage.sync.syncNow")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSyncData}
                disabled={isRunning || entryCount === 0}
              >
                {t("settings.storage.sync.clear")}
              </Button>
            </div>
          </ContentItemForm>
        </ContentItem>
      </Content>
      <ContentSeparator />
    </Root>
  );
}
