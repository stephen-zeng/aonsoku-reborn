import { useCallback, useMemo, useState } from "react";
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
import { ConfirmationDialog } from "@/app/components/ui/confirmation-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Input } from "@/app/components/ui/input";
import { cacheManager } from "@/service/cache";
import { syncService } from "@/service/cache/sync-worker-adapter";
import { clearLibraryData } from "@/store/library-db";
import {
  type CachePoolBreakdown,
  useCachePoolStats,
} from "@/store/cache-index.store";
import {
  useCacheActions,
  useCacheSettings,
  useCacheStore,
  useIsOnline,
  useLastSyncedAt,
  useLibraryCaching,
  useSmartRules,
} from "@/store/cache.store";
import {
  CACHE_SIZE_OPTIONS,
  type CacheMetaSource,
  DOWNLOAD_QUALITIES,
  DownloadQuality,
} from "@/types/cache";
import dateTime from "@/utils/dateTime";
import { formatBytes } from "@/utils/formatBytes";

const downloadQualities: DownloadQuality[] = DOWNLOAD_QUALITIES;

function StreamingSection() {
  const { t } = useTranslation();
  const { streamQuality } = useCacheSettings();
  const { setStreamQuality } = useCacheActions();

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.storage.streaming.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.streaming.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.storage.downloadQuality.streamInfo")}
          >
            {t("settings.storage.downloadQuality.streamLabel")}
          </ContentItemTitle>
          <ContentItemForm>
            <Select
              value={streamQuality}
              onValueChange={(value) =>
                setStreamQuality(value as DownloadQuality)
              }
            >
              <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left">
                <SelectValue>
                  <span className="text-sm text-foreground">
                    {t(
                      `settings.storage.downloadQuality.tier.${streamQuality}`,
                    )}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {downloadQualities.map((q) => (
                    <SelectItem key={q} value={q}>
                      {t(`settings.storage.downloadQuality.tier.${q}`)}
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

function LibraryCachingSection() {
  const { t } = useTranslation();
  const libraryCaching = useLibraryCaching();
  const syncCoverArt = useCacheStore((s) => s.settings.syncCoverArt);
  const { setLibraryCaching, setLastSyncedAt, setSyncCoverArt } =
    useCacheActions();
  const lastSyncedAt = useLastSyncedAt();
  const isSyncing = useCacheStore((s) => s.status.syncState.isSyncing);
  const isOnline = useIsOnline();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleToggle = useCallback(
    (checked: boolean) => {
      if (!checked && lastSyncedAt !== null) {
        setConfirmOpen(true);
        return;
      }
      setLibraryCaching(checked);
    },
    [lastSyncedAt, setLibraryCaching],
  );

  const handleConfirmClear = useCallback(async () => {
    await clearLibraryData();
    setLastSyncedAt(null);
    setLibraryCaching(false);
    setConfirmOpen(false);
  }, [setLastSyncedAt, setLibraryCaching]);

  const handleRefresh = useCallback(() => {
    syncService.syncIncremental({
      includeCoverArt: syncCoverArt,
      includeFullSongs: true,
    });
  }, [syncCoverArt]);

  const handleCancel = useCallback(() => {
    syncService.cancel();
  }, []);

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.storage.offline.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.offline.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.storage.sync.libraryCachingInfo")}
          >
            {t("settings.storage.sync.libraryCaching")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={libraryCaching}
              onCheckedChange={handleToggle}
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
              disabled={!libraryCaching}
            />
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.sync.lastSynced")}
          </ContentItemTitle>
          <ContentItemForm className="gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {lastSyncedAt
                ? dateTime(lastSyncedAt).fromNow()
                : t("settings.storage.sync.never")}
            </span>
            {libraryCaching &&
              (isSyncing ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleCancel}
                >
                  {t("settings.storage.sync.cancel")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={handleRefresh}
                  disabled={!isOnline}
                >
                  {t("settings.storage.sync.syncNow")}
                </Button>
              ))}
          </ContentItemForm>
        </ContentItem>
      </Content>

      <ContentSeparator />

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("settings.storage.sync.clearConfirm.title")}
        description={t("settings.storage.sync.clearConfirm.description")}
        onConfirm={handleConfirmClear}
        cancelLabel={t("settings.storage.sync.clearConfirm.keep")}
        confirmLabel={t("settings.storage.sync.clearConfirm.clear")}
      />
    </Root>
  );
}

function DownloadQualitySection() {
  const { t } = useTranslation();
  const { downloadQuality } = useCacheSettings();
  const { setDownloadQuality } = useCacheActions();

  return (
    <Root>
      <Header>
        <HeaderTitle>
          {t("settings.storage.downloadQuality.group")}
        </HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.downloadQuality.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.storage.downloadQuality.downloadInfo")}
          >
            {t("settings.storage.downloadQuality.downloadLabel")}
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
                      `settings.storage.downloadQuality.tier.${downloadQuality}`,
                    )}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  {downloadQualities.map((q) => (
                    <SelectItem key={q} value={q}>
                      {t(`settings.storage.downloadQuality.tier.${q}`)}
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

function SmartDownloadSection() {
  const { t } = useTranslation();
  const rules = useSmartRules();
  const { setSmartRules } = useCacheActions();
  const { smartQuota, lruQuota } = useCacheSettings();
  const { setSmartQuota, setLruQuota } = useCacheActions();
  const stats = useCachePoolStats();

  const setEnabled = (enabled: boolean) => setSmartRules({ enabled });
  const setRule = (key: keyof typeof rules, value: boolean) =>
    setSmartRules({ [key]: value } as Partial<typeof rules>);
  const setThreshold = (
    key: "frequentPlaysThreshold" | "recentPlaysDays",
    value: number,
  ) => setSmartRules({ [key]: Math.max(1, value) });

  const sizeLabel = useMemo(() => {
    if (smartQuota === 0) {
      return t("settings.storage.limits.unlimited");
    }
    const option = CACHE_SIZE_OPTIONS.find((o) => o.value === smartQuota);
    return option?.label ?? formatBytes(smartQuota);
  }, [smartQuota, t]);

  const handleClearSmart = useCallback(() => {
    cacheManager.clearAudioBySource("smart");
  }, []);

  const handleClearLru = useCallback(() => {
    cacheManager.clearAudioBySource("lru");
  }, []);

  const lruSizeLabel = useMemo(() => {
    if (lruQuota === 0) {
      return t("settings.storage.limits.unlimited");
    }
    const option = CACHE_SIZE_OPTIONS.find((o) => o.value === lruQuota);
    return option?.label ?? formatBytes(lruQuota);
  }, [lruQuota, t]);

  const rows: Array<{
    key: keyof typeof rules;
    labelKey: string;
    extra?: JSX.Element;
  }> = [
    {
      key: "favoriteSongs",
      labelKey: "settings.storage.smart.rule.favoriteSongs",
    },
    {
      key: "favoritePlaylists",
      labelKey: "settings.storage.smart.rule.favoritePlaylists",
    },
    {
      key: "frequentPlays",
      labelKey: "settings.storage.smart.rule.frequentPlays",
      extra: (
        <Input
          type="number"
          min={1}
          max={999}
          value={rules.frequentPlaysThreshold}
          onChange={(e) =>
            setThreshold("frequentPlaysThreshold", Number(e.target.value))
          }
          disabled={!rules.enabled || !rules.frequentPlays}
          className="h-7 w-16 text-xs"
        />
      ),
    },
    {
      key: "recentPlays",
      labelKey: "settings.storage.smart.rule.recentPlays",
      extra: (
        <Input
          type="number"
          min={1}
          max={365}
          value={rules.recentPlaysDays}
          onChange={(e) =>
            setThreshold("recentPlaysDays", Number(e.target.value))
          }
          disabled={!rules.enabled || !rules.recentPlays}
          className="h-7 w-16 text-xs"
        />
      ),
    },
  ];

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.storage.smart.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.storage.smart.description")}
        </HeaderDescription>
      </Header>

      <Content>
        <ContentItem>
          <ContentItemTitle>
            {t("settings.storage.smart.enabled")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch checked={rules.enabled} onCheckedChange={setEnabled} />
          </ContentItemForm>
        </ContentItem>

        {rows.map(({ key, labelKey, extra }) => (
          <ContentItem key={key}>
            <ContentItemTitle>{t(labelKey)}</ContentItemTitle>
            <ContentItemForm className="gap-2">
              {extra}
              <Switch
                checked={rules.enabled && Boolean(rules[key])}
                disabled={!rules.enabled}
                onCheckedChange={(v) => setRule(key, v)}
              />
            </ContentItemForm>
          </ContentItem>
        ))}

        <ContentItem>
          <ContentItemTitle info={t("settings.storage.limits.quota")}>
            {t("settings.storage.limits.pool.smart.label")}
          </ContentItemTitle>
          <ContentItemForm className="gap-2">
            <Select
              value={smartQuota.toString()}
              onValueChange={(value) => setSmartQuota(Number(value))}
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleClearSmart}
              disabled={stats.smart.count === 0}
            >
              {t("settings.storage.limits.clearAudio")}
            </Button>
          </ContentItemForm>
        </ContentItem>

        <ContentItem>
          <ContentItemTitle info={t("settings.storage.limits.quota")}>
            {t("settings.storage.limits.pool.lru.label")}
          </ContentItemTitle>
          <ContentItemForm className="gap-2">
            <Select
              value={lruQuota.toString()}
              onValueChange={(value) => setLruQuota(Number(value))}
            >
              <SelectTrigger className="h-8 ring-offset-transparent focus:ring-0 focus:ring-transparent text-left w-[130px]">
                <SelectValue>
                  <span className="text-sm text-foreground">{lruSizeLabel}</span>
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
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleClearLru}
              disabled={stats.lru.count === 0}
            >
              {t("settings.storage.limits.clearAudio")}
            </Button>
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
  const { assetsQuota } = useCacheSettings();
  const { setAssetsQuota } = useCacheActions();
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

export function Storage() {
  const libraryCaching = useLibraryCaching();

  return (
    <div className="space-y-4">
      <StreamingSection />
      <LibraryCachingSection />
      {libraryCaching && <DownloadQualitySection />}
      {libraryCaching && <SmartDownloadSection />}
      <CacheLimitsSection />
    </div>
  );
}