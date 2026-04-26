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
import { useHapticSettings } from "@/store/player.store";

export function HapticFeedbackSettings() {
  const { t } = useTranslation();
  const { hapticFeedbackEnabled, setHapticFeedbackEnabled } =
    useHapticSettings();

  return (
    <Root>
      <Header>
        <HeaderTitle>
          {t("settings.audio.hapticFeedback.group")}
        </HeaderTitle>
        <HeaderDescription>
          {t("settings.audio.hapticFeedback.description")}
        </HeaderDescription>
      </Header>
      <Content>
        <ContentItem>
          <ContentItemTitle
            info={t("settings.audio.hapticFeedback.enabled.info")}
          >
            {t("settings.audio.hapticFeedback.enabled.label")}
          </ContentItemTitle>
          <ContentItemForm>
            <Switch
              checked={hapticFeedbackEnabled}
              onCheckedChange={setHapticFeedbackEnabled}
            />
          </ContentItemForm>
        </ContentItem>
      </Content>
      <ContentSeparator />
    </Root>
  );
}