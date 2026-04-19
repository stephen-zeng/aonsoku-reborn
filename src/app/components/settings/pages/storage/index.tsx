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
  type CachePoolBreakdown,
  useCachePoolStats,
} from "@/store/cache-index.store";
import {
  useCacheActions,
  useCacheSettings,
  useLastSyncedAt,
} from "@/store/cache.store";
import {
  CACHE_SIZE_OPTIONS,
  type CacheMetaSource,
  DownloadQuality,
} from "@/types/cache";
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

interface PoolRowProps {
  labelKey: "explicit" | "smart" | "lru" | "assets";
  stats: CachePoolBreakdown;
  quota: number | null;
  onQuotaChange?: (bytes: number) => void;
  onClear: () => void;
}

function PoolRow({
  labelKey,
  stats,
  quota,
  onQuotaChange,
  onClear,
}: PoolRowProps) {
  const { t } = useTranslation();
  const sizeLabel = useMemo(() => {
    if (quota === null || quota === 0) {
      return t("settings.storage.limits.unlimited");
    }
    const option = CACHE_SIZE_OPTIONS.find((o) => o.value === quota);
    return option?.label ?? formatBytes(quota);
  }, [quota, t]);

  const entriesLabel =
    labelKey === "assets"
      ? t("settings.storage.limits.imageEntries", { count: stats.count })
      : t("settings.storage.limits.songEntries", { count: stats.count });

  return (
    <ContentItem className="flex-col items-start gap-2 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <ContentItemTitle>
          {t(`settings.storage.limits.pool.${labelKey}.label`)}
        </ContentItemTitle>
        <p className="text-xs text-muted-foreground">
          {t(`settings.storage.limits.pool.${labelKey}.description`)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatBytes(stats.sizeBytes)} · {entriesLabel}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onQuotaChange && quota !== null ? (
          <Select
            value={quota.toString()}
            onValueChange={(value) => onQuotaChange(Number(value))}
          >
            <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left w-[130px]">
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
        ) : (
          <span className="text-xs text-muted-foreground">{sizeLabel}</span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onClear}
          disabled={stats.count === 0}
        >
          {t("settings.storage.limits.clearAudio")}
        </Button>
      </div>
    </ContentItem>
  );
}

function CacheLimitsSection() {
  const { t } = useTranslation();
  const { assetsQuota, lruQuota, smartQuota } = useCacheSettings();
  const { setAssetsQuota, setLruQuota, setSmartQuota } = useCacheActions();
  const stats = useCachePoolStats();

  const totalCount =
    stats.explicit.count +
    stats.smart.count +
    stats.lru.count +
    stats.assets.count;

  const clearBySource = useCallback(
    (source: CacheMetaSource) => () => {
      cacheManager.clearAudioBySource(source);
    },
    [],
  );

  const handleClearAssets = useCallback(() => {
    cacheManager.clearAssets();
  }, []);

  const handleClearAll = useCallback(() => {
    cacheManager.clearAllCaches();
  }, []);

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.storage.limits.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.limits.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <PoolRow
          labelKey="explicit"
          stats={stats.explicit}
          quota={null}
          onClear={clearBySource("explicit")}
        />
        <PoolRow
          labelKey="smart"
          stats={stats.smart}
          quota={smartQuota}
          onQuotaChange={setSmartQuota}
          onClear={clearBySource("smart")}
        />
        <PoolRow
          labelKey="lru"
          stats={stats.lru}
          quota={lruQuota}
          onQuotaChange={setLruQuota}
          onClear={clearBySource("lru")}
        />
        <PoolRow
          labelKey="assets"
          stats={stats.assets}
          quota={assetsQuota}
          onQuotaChange={setAssetsQuota}
          onClear={handleClearAssets}
        />

        <ContentItem>
          <div className="flex-1" />
          <ContentItemForm>
            <Button
              size="sm"
              variant="destructive"
              className="h-8"
              onClick={handleClearAll}
              disabled={totalCount === 0}
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
