import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
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
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { useLyricsSettings } from "@/store/player.store";
import type { LyricsSource } from "@/types/playerContext";
import { isValidServerUrl, normalizeServerUrl } from "@/utils/serverUrl";

const lyricsSources: LyricsSource[] = ["navidrome", "lrclib", "custom"];

export function LyricsSettings() {
  const { t } = useTranslation();
  const {
    preferSyncedLyrics,
    setPreferSyncedLyrics,
    showTranslation,
    setShowTranslation,
    sourcePriority,
    setSourcePriority,
    customServerEnabled,
    setCustomServerEnabled,
    customServerUrl,
    setCustomServerUrl,
    customServerPassword,
    setCustomServerPassword,
  } = useLyricsSettings();
  const [urlValue, setUrlValue] = useState(customServerUrl);

  useEffect(() => {
    setUrlValue(customServerUrl);
  }, [customServerUrl]);

  function handleSaveCustomServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedUrl = normalizeServerUrl(urlValue);

    if (normalizedUrl && !isValidServerUrl(normalizedUrl)) {
      toast.error(t("settings.audio.lyrics.customServer.url.invalid"));
      return;
    }

    setCustomServerUrl(normalizedUrl);
    toast.success(t("settings.audio.lyrics.customServer.saved"));
  }

  function handlePriorityChange(index: number, source: LyricsSource) {
    const nextPriority = [...sourcePriority];
    const existingIndex = nextPriority.indexOf(source);
    const previousSource = nextPriority[index];

    nextPriority[index] = source;
    if (existingIndex !== -1 && existingIndex !== index) {
      nextPriority[existingIndex] = previousSource;
    }

    setSourcePriority(nextPriority);
  }

  return (
    <Root>
      <Header>
        <HeaderTitle>{t("settings.audio.lyrics.group")}</HeaderTitle>
        <HeaderDescription>
          {t("settings.audio.lyrics.description")}
        </HeaderDescription>
      </Header>
      <Content>
        <ContentItem>
          <ContentItemTitle info={t("settings.audio.lyrics.preferSynced.info")}>
            {t("settings.audio.lyrics.preferSynced.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={preferSyncedLyrics}
              onCheckedChange={setPreferSyncedLyrics}
            />
          </ContentItemForm>
        </ContentItem>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.audio.lyrics.showTranslation.info")}
          >
            {t("settings.audio.lyrics.showTranslation.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={showTranslation}
              onCheckedChange={setShowTranslation}
            />
          </ContentItemForm>
        </ContentItem>
        <ContentItem>
          <ContentItemTitle info={t("settings.audio.lyrics.source.info")}>
            {t("settings.audio.lyrics.source.label")}
          </ContentItemTitle>
          <ContentItemForm className="flex-col items-end gap-2">
            {sourcePriority.map((source, index) => (
              <Select
                key={index}
                value={source}
                onValueChange={(value) =>
                  handlePriorityChange(index, value as LyricsSource)
                }
              >
                <SelectTrigger className="h-8 w-44 ring-offset-transparent focus-visible:ring-0 focus-visible:ring-transparent text-left">
                  <SelectValue>
                    <span className="text-sm text-foreground">
                      {t("settings.audio.lyrics.source.priority", {
                        priority: index + 1,
                        source: t("settings.audio.lyrics.source." + source),
                      })}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectGroup>
                    {lyricsSources.map((lyricsSource) => (
                      <SelectItem key={lyricsSource} value={lyricsSource}>
                        {t("settings.audio.lyrics.source." + lyricsSource)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ))}
          </ContentItemForm>
        </ContentItem>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.audio.lyrics.customServer.enabled.info")}
          >
            {t("settings.audio.lyrics.customServer.enabled.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={customServerEnabled}
              onCheckedChange={setCustomServerEnabled}
            />
          </ContentItemForm>
        </ContentItem>
        <form onSubmit={handleSaveCustomServer}>
          <ContentItem className="items-start gap-4">
            <ContentItemTitle
              info={t("settings.audio.lyrics.customServer.url.info")}
            >
              {t("settings.audio.lyrics.customServer.url.label")}
            </ContentItemTitle>
            <ContentItemForm className="max-w-none w-3/5 gap-2">
              <Input
                value={urlValue}
                onChange={(event) => setUrlValue(event.target.value)}
                placeholder={t(
                  "settings.audio.lyrics.customServer.url.placeholder",
                )}
                autoCorrect="false"
                autoCapitalize="false"
                spellCheck="false"
              />
              <Button type="submit" className="h-8">
                {t("settings.audio.lyrics.customServer.save")}
              </Button>
            </ContentItemForm>
          </ContentItem>
          <ContentItem className="items-start gap-4">
            <ContentItemTitle
              info={t("settings.audio.lyrics.customServer.password.info")}
            >
              {t("settings.audio.lyrics.customServer.password.label")}
            </ContentItemTitle>
            <ContentItemForm className="max-w-none w-3/5">
              <Input
                type="password"
                value={customServerPassword}
                onChange={(event) =>
                  setCustomServerPassword(event.target.value)
                }
                placeholder={t(
                  "settings.audio.lyrics.customServer.password.placeholder",
                )}
                autoCorrect="false"
                autoCapitalize="false"
                spellCheck="false"
              />
            </ContentItemForm>
          </ContentItem>
        </form>
      </Content>
      <ContentSeparator />
    </Root>
  );
}
