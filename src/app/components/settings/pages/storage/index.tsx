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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import {
  clearAllCaches,
  clearAudioCache,
  clearCoverArtCache,
  formatBytes,
  getAudioCacheCount,
  getAudioCacheSize,
  getCoverArtCacheCount,
  getCoverArtCacheSize,
} from "@/lib/cache/cache-manager";
import { useCacheActions, useCacheSettings } from "@/store/cache.store";

const CACHE_SIZE_OPTIONS = [
  { value: 536870912, label: "512 MB" },
  { value: 1073741824, label: "1 GB" },
  { value: 2147483648, label: "2 GB" },
  { value: 5368709120, label: "5 GB" },
  { value: 10737418240, label: "10 GB" },
];

function useCacheStats() {
  const [coverArtSize, setCoverArtSize] = useState(0);
  const [coverArtCount, setCoverArtCount] = useState(0);
  const [audioSize, setAudioSize] = useState(0);
  const [audioCount, setAudioCount] = useState(0);

  const refresh = useCallback(async () => {
    const [caSize, caCount, aSize, aCount] = await Promise.all([
      getCoverArtCacheSize(),
      getCoverArtCacheCount(),
      getAudioCacheSize(),
      getAudioCacheCount(),
    ]);
    setCoverArtSize(caSize);
    setCoverArtCount(caCount);
    setAudioSize(aSize);
    setAudioCount(aCount);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { coverArtSize, coverArtCount, audioSize, audioCount, refresh };
}

export function Storage() {
  const { t } = useTranslation();
  const { coverArtCacheEnabled, audioCacheEnabled, audioCacheMaxSize } =
    useCacheSettings();
  const {
    setCoverArtCacheEnabled,
    setAudioCacheEnabled,
    setAudioCacheMaxSize,
  } = useCacheActions();
  const { coverArtSize, coverArtCount, audioSize, audioCount, refresh } =
    useCacheStats();

  async function handleClearCoverArt() {
    await clearCoverArtCache();
    refresh();
  }

  async function handleClearAudio() {
    await clearAudioCache();
    refresh();
  }

  async function handleClearAll() {
    await clearAllCaches();
    refresh();
  }

  return (
    <div className="space-y-4">
      <Root>
        <Header>
          <HeaderTitle>{t("settings.storage.coverArt.group")}</HeaderTitle>
          <HeaderDescription>
            {t("settings.storage.coverArt.description")}
          </HeaderDescription>
        </Header>
        <Content>
          <ContentItem>
            <ContentItemTitle>
              {t("settings.storage.coverArt.enabled")}
            </ContentItemTitle>
            <ContentItemForm>
              <Switch
                checked={coverArtCacheEnabled}
                onCheckedChange={setCoverArtCacheEnabled}
              />
            </ContentItemForm>
          </ContentItem>
          <ContentItem>
            <ContentItemTitle>
              {t("settings.storage.coverArt.size")}
            </ContentItemTitle>
            <ContentItemForm>
              <span className="text-sm text-muted-foreground">
                {formatBytes(coverArtSize)}
              </span>
            </ContentItemForm>
          </ContentItem>
          <ContentItem>
            <span className="flex-1 text-xs text-muted-foreground">
              {t("settings.storage.coverArt.entries", {
                count: coverArtCount,
              })}
            </span>
            <ContentItemForm>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCoverArt}
                disabled={coverArtCount === 0}
              >
                {t("settings.storage.coverArt.clear")}
              </Button>
            </ContentItemForm>
          </ContentItem>
        </Content>
        <ContentSeparator />
      </Root>

      <Root>
        <Header>
          <HeaderTitle>{t("settings.storage.audio.group")}</HeaderTitle>
          <HeaderDescription>
            {t("settings.storage.audio.description")}
          </HeaderDescription>
        </Header>
        <Content>
          <ContentItem>
            <ContentItemTitle>
              {t("settings.storage.audio.enabled")}
            </ContentItemTitle>
            <ContentItemForm>
              <Switch
                checked={audioCacheEnabled}
                onCheckedChange={setAudioCacheEnabled}
              />
            </ContentItemForm>
          </ContentItem>
          <ContentItem>
            <ContentItemTitle>
              {t("settings.storage.audio.maxSize")}
            </ContentItemTitle>
            <ContentItemForm>
              <Select
                value={audioCacheMaxSize.toString()}
                onValueChange={(value) => setAudioCacheMaxSize(Number(value))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CACHE_SIZE_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value.toString()}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ContentItemForm>
          </ContentItem>
          <ContentItem>
            <ContentItemTitle>
              {t("settings.storage.audio.size")}
            </ContentItemTitle>
            <ContentItemForm>
              <span className="text-sm text-muted-foreground">
                {formatBytes(audioSize)} / {formatBytes(audioCacheMaxSize)}
              </span>
            </ContentItemForm>
          </ContentItem>
          <ContentItem>
            <span className="flex-1 text-xs text-muted-foreground">
              {t("settings.storage.audio.entries", {
                count: audioCount,
              })}
            </span>
            <ContentItemForm>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAudio}
                disabled={audioCount === 0}
              >
                {t("settings.storage.audio.clear")}
              </Button>
            </ContentItemForm>
          </ContentItem>
        </Content>
        <ContentSeparator />
      </Root>

      <Root>
        <Header>
          <HeaderTitle>{t("settings.storage.metadata.group")}</HeaderTitle>
          <HeaderDescription>
            {t("settings.storage.metadata.description")}
          </HeaderDescription>
        </Header>
        <Content>
          <ContentItem>
            <span className="flex-1" />
            <ContentItemForm>
              <Button variant="destructive" size="sm" onClick={handleClearAll}>
                {t("settings.storage.metadata.clear")}
              </Button>
            </ContentItemForm>
          </ContentItem>
        </Content>
      </Root>
    </div>
  );
}
