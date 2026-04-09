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
import {
  CACHE_SIZE_OPTIONS,
  CacheMode,
} from "@/types/cache";
import dateTime from "@/utils/dateTime";
import { formatBytes } from "@/utils/formatBytes";

const cacheModes: CacheMode[] = [
  "none",
  "performance",
  "offline",
];

function CacheModeSection() {
  const { t } = useTranslation();
  const { mode } = useCacheSettings();
  const { setMode } = useCacheActions();

  return (
    <Root>
      <Header>
        <HeaderTitle>
          {t("settings.storage.mode.group")}
        </HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.mode.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.mode.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Select
              value={mode}
              onValueChange={(value) =>
                setMode(value as CacheMode)
              }
            >
              <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left">
                <SelectValue>
                  <span className="text-sm text-foreground">
                    {t(
                      `settings.storage.mode.${mode}.label`,
                    )}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {cacheModes.map((m) => (
                    <SelectItem key={m} value={m}>
                      <div className="flex flex-col">
                        <span>
                          {t(
                            `settings.storage.mode.${m}.label`,
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(
                            `settings.storage.mode.${m}.description`,
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
  const { maxCacheSize, mode } = useCacheSettings();
  const { setMaxCacheSize } = useCacheActions();
  const { audioSize, coverSize, audioCount, coverCount } =
    useCacheStats();

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
    const option = CACHE_SIZE_OPTIONS.find(
      (o) => o.value === maxCacheSize,
    );
    return option?.label ?? formatBytes(maxCacheSize);
  }, [maxCacheSize]);

  if (mode === "none") return null;

  return (
    <Root>
      <Header>
        <HeaderTitle>
          {t("settings.storage.limits.group")}
        </HeaderTitle>
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
              onValueChange={(value) =>
                setMaxCacheSize(Number(value))
              }
            >
              <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left">
                <SelectValue>
                  <span className="text-sm text-foreground">
                    {sizeLabel}
                  </span>
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

function SyncSection() {
  const { t } = useTranslation();
  const { mode, syncOnLaunch, syncCoverArt } =
    useCacheSettings();
  const { setSyncOnLaunch, setSyncCoverArt } =
    useCacheActions();
  const lastSyncedAt = useLastSyncedAt();

  if (mode !== "offline") return null;

  return (
    <Root>
      <Header>
        <HeaderTitle>
          {t("settings.storage.sync.group")}
        </HeaderTitle>
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
              checked={syncOnLaunch}
              onCheckedChange={setSyncOnLaunch}
            />
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle
            info={t(
              "settings.storage.sync.coverArtInfo",
            )}
          >
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
      </Content>
    </Root>
  );
}

export function Storage() {
  return (
    <div className="space-y-4">
      <CacheModeSection />
      <CacheLimitsSection />
      <SyncSection />
    </div>
  );
}
