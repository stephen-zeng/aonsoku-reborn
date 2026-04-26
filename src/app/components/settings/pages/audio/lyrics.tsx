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
import { Switch } from "@/app/components/ui/switch";
import { useLyricsSettings } from "@/store/player.store";

export function LyricsSettings() {
  const { t } = useTranslation();
  const {
    preferSyncedLyrics,
    setPreferSyncedLyrics,
    showTranslation,
    setShowTranslation,
  } = useLyricsSettings();

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
      </Content>
      <ContentSeparator />
    </Root>
  );
}
