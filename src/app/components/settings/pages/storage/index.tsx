import { useCallback, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { cacheManager } from "@/service/cache";
import {
  useCacheActions,
  useCacheSettings,
  useCacheStats,
  useLastSyncedAt,
} from "@/store/cache.store";
import { CACHE_SIZE_OPTIONS, DownloadQuality } from "@/types/cache";
import dateTime from "@/utils/dateTime";
import { formatBytes } from "@/utils/formatBytes";

const downloadQualities: DownloadQuality[] = ["stream", "original"];

function DownloadQualitySection() {
  const { t } = useTranslation();
  const { downloadQuality } = useCacheSettings();
  const { setDownloadQuality } = useCacheActions();

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.storage.downloadQuality.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.downloadQuality.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.downloadQuality.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Select
              value={downloadQuality}
              onValueChange={(value) =>
                setDownloadQuality(value as DownloadQuality)
              }
            >
              <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left">
                <SelectValue>
                  <span className="text-sm text-foreground">
                    {t(
                      `settings.storage.downloadQuality.${downloadQuality}.label`,
                    )}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {downloadQualities.map((q) => (
                    <SelectItem key={q} value={q}>
                      <div className="flex flex-col">
                        <span>
                          {t(`settings.storage.downloadQuality.${q}.label`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(
                            `settings.storage.downloadQuality.${q}.description`,
                          )}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </ContentItemForm>
        </ContentItem>
      </Content>

      <ContentSeparator />
    </Root>
  );
}

function CacheLimitsSection() {
  const { t } = useTranslation();
  const { maxCacheSize } = useCacheSettings();
  const { setMaxCacheSize } = useCacheActions();
  const { audioSize, coverSize, audioCount, coverCount } = useCacheStats();

  const handleClearAudio = useCallback(() => {
    cacheManager.clearAudioCache();
  }, []);

  const handleClearCovers = useCallback(() => {
    cacheManager.clearCoverCache();
  }, []);

  const handleClearAll = useCallback(() => {
    cacheManager.clearAllCaches();
  }, []);

  const sizeLabel = useMemo(() => {
    const option = CACHE_SIZE_OPTIONS.find((o) => o.value === maxCacheSize);
    return option?.label ?? formatBytes(maxCacheSize);
  }, [maxCacheSize]);

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.storage.limits.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.limits.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.limits.maxSize")}
          </ContentItemTitle>
          <ContentItemForm>
            <Select
              value={maxCacheSize.toString()}
              onValueChange={(value) => setMaxCacheSize(Number(value))}
            >
              <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left">
                <SelectValue>
                  <span className="text-sm text-foreground">{sizeLabel}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {CACHE_SIZE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value.toString()}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.limits.audioSize")}
          </ContentItemTitle>
          <ContentItemForm className="gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatBytes(audioSize)} (
              {t("settings.storage.limits.audioEntries", {
                count: audioCount,
              })}
              )
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleClearAudio}
              disabled={audioCount === 0}
            >
              {t("settings.storage.limits.clearAudio")}
            </Button>
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.limits.coverSize")}
          </ContentItemTitle>
          <ContentItemForm className="gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatBytes(coverSize)} (
              {t("settings.storage.limits.coverEntries", {
                count: coverCount,
              })}
              )
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleClearCovers}
              disabled={coverCount === 0}
            >
              {t("settings.storage.limits.clearCovers")}
            </Button>
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <div className="flex-1" />
          <ContentItemForm>
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
              onClick={handleClearAll}
              disabled={audioCount === 0 && coverCount === 0}
            >
              {t("settings.storage.limits.clearAll")}
            </Button>
          </ContentItemForm>
        </ContentItem>
      </Content>

      <ContentSeparator />
    </Root>
  );
}

function SyncLibrarySection() {
  const { t } = useTranslation();
  const { syncLibrary, syncCoverArt } = useCacheSettings();
  const { setSyncLibrary, setSyncCoverArt } = useCacheActions();
  const lastSyncedAt = useLastSyncedAt();

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
            <Switch checked={syncLibrary} onCheckedChange={setSyncLibrary} />
          </ContentItemForm>
        </ContentItem>

        {syncLibrary && (
          <>
            <ContentItem>
              <ContentItemTitle info={t("settings.storage.sync.coverArtInfo")}>
                {t("settings.storage.sync.coverArt")}
              </ContentItemTitle>
              <ContentItemForm>
                <Switch
                  checked={syncCoverArt}
                  onCheckedChange={setSyncCoverArt}
                />
              </ContentItemForm>
            </ContentItem>

            <ContentItem>
              <ContentItemTitle>
                {t("settings.storage.sync.lastSynced")}
              </ContentItemTitle>
              <ContentItemForm>
                <span className="text-xs text-muted-foreground">
                  {lastSyncedAt
                    ? dateTime(lastSyncedAt).fromNow()
                    : t("settings.storage.sync.never")}
                </span>
              </ContentItemForm>
            </ContentItem>
          </>
        )}
      </Content>
    </Root>
  );
}

export function Storage() {
  return (
    <div className="space-y-4">
      <DownloadQualitySection />
      <CacheLimitsSection />
      <SyncLibrarySection />
    </div>
  );
}
